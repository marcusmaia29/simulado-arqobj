# simulado-arqobj

Java 25, Spring Boot 4.1.2 e PostgreSQL. Autenticação Auth0 com JWT e permissões por role.

## Executar localmente

Com o PostgreSQL `postgres-avaliacoes` ativo na porta 5433, defina `DB_PASSWORD` e execute `./mvnw spring-boot:run` (Windows: `mvnw.cmd spring-boot:run`).

Variáveis: `DB_HOST` (padrão `localhost`), `DB_PORT` (`5433`), `DB_NAME` (`avaliacoesdb`), `DB_USER` (`usuario`), `DB_PASSWORD` (obrigatória), `PORT` (`8080`).

Build e testes: `./mvnw verify`. Os testes precisam de um PostgreSQL acessível pelas mesmas variáveis.

Após o build: `docker build -t simulado-arqobj .`. Para usar o banco na rede Docker local, passe `DB_HOST=postgres-avaliacoes` e `DB_PORT=5432`, junto das demais variáveis.

## Deploy

Cada push na `main` executa `.github/workflows/deploy.yml`:

1. Prepara Java 25 Temurin e um PostgreSQL temporário para os testes.
2. Executa Maven com testes e empacota a aplicação.
3. Publica a imagem no DockerHub com tags do commit e `latest`.
4. Conecta por SSH à AWS e substitui somente o container `simulado-arqobj`.
5. Inicia a aplicação na rede `simulado-rede`, porta 8080, usando o banco `postgres-avaliacoes:5432`.
6. Aguarda `GET /actuator/health` retornar HTTP 200. A saúde inclui a conexão com o PostgreSQL e não expõe detalhes internos.

Secrets do repositório: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `HOST_TEST`, `KEY_TEST`, `DB_PASSWORD` e `HOST_FINGERPRINT` (fingerprint pública SSH da instância). O usuário SSH é `ubuntu`.

A AWS precisa ter Docker, curl, a rede `simulado-rede` e o PostgreSQL próprio já ativos. O workflow não altera o banco nem containers de outros projetos e não executa limpeza global do Docker.

Validação na instância: `curl --fail http://127.0.0.1:8080/actuator/health` deve retornar `{"status":"UP"}`. O acesso externo também depende da regra de entrada da porta 8080 na AWS.

## Auth0 e avaliações

O backend valida a assinatura RS256, o emissor, o destinatário (`audience`) e a validade do token. Não utiliza Client Secret: as chaves públicas vêm do Auth0.

Configuração por variáveis de ambiente (também cadastradas como **Variables** no GitHub Actions):

- `AUTH0_ISSUER_URI`: `https://dev-igd77oddewxpkhl0.us.auth0.com/`
- `AUTH0_AUDIENCE`: `https://simulado-arqobj-api`
- `APP_ALLOWED_ORIGINS`: `http://localhost:5173`; para mais origens, separar por vírgulas.

O Spring Boot usa a propriedade `spring.security.oauth2.resourceserver.jwt.audiences` (plural) para validar o destinatário. O Client ID `DT5QIElpIs9Au5OeogD0sq9GvxgkBVEq` pertence ao frontend SPA e não é o audience da API.

A Action de pós-login já ativa no Auth0, `ProjSoft-Aula`, inclui no access token:

- `https://social-insper.com/email`: e-mail do usuário autenticado.
- `https://social-insper.com/roles`: lista de roles, por exemplo `["ADMIN"]`.

| Rota | Acesso | Resposta de sucesso |
| --- | --- | --- |
| `GET /avaliacoes` | Qualquer usuário com access token válido | 200, lista de avaliações |
| `POST /avaliacoes` | Access token válido com role `ADMIN` | 201, avaliação criada |
| `GET /actuator/health` | Público, usado para verificar deploy | 200, status UP |

Sem token ou com token inválido: **401**. Usuário autenticado sem ADMIN tentando cadastrar: **403**. Dados inválidos: **400**.

Exemplo de corpo para cadastrar, com header `Authorization: Bearer ACCESS_TOKEN` e `Content-Type: application/json`:

```json
{
  "emailAvaliado": "colega@example.com",
  "comentarios": "Boa comunicação com a equipe",
  "nota": 9
}
```

`id`, `emailAvaliador` e `dataAvaliacao` são definidos pelo backend. O e-mail do avaliador vem exclusivamente do token. Nota deve ser um inteiro entre 0 e 10.

Os testes de integração usam tokens RS256 assinados por uma chave temporária exclusiva de teste, um servidor JWKS local e PostgreSQL. Verificam 401/403/201, assinatura, emissor, audience, expiração, persistência, validação dos campos e CORS. Não pedem senhas de usuários Auth0.

## Frontend React

O frontend está em `frontend/`, no mesmo repositório. Usa React, Vite e o SDK oficial `@auth0/auth0-react`.

```sh
cd frontend
npm ci
npm run dev
```

Acesse `http://localhost:5173`. `npm run build` gera `frontend/dist`. O GitHub Actions verifica o build do frontend antes do deploy do backend.

Os identificadores públicos do simulado já têm valores padrão. Para adaptar a outro projeto, copie `.env.example` para `.env.local` e ajuste `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE` e `VITE_API_URL`. Nunca coloque Client Secret no frontend.

Na Vercel, importe este repositório e selecione **Root Directory: frontend**, framework **Vite**, build `npm run build` e output `dist`. `frontend/vercel.json` encaminha `/api/*` à API da AWS; o navegador usa HTTPS com a Vercel e não acessa diretamente o endereço HTTP da AWS. Para um ambiente de produção real, a conexão da hospedagem ao backend também deve usar HTTPS.

No Auth0, a aplicação SPA precisa permitir `http://localhost:5173` e a URL de produção da Vercel em **Allowed Callback URLs**, **Allowed Logout URLs** e **Allowed Web Origins**. A variável `APP_ALLOWED_ORIGINS` do backend deve permitir as mesmas origens, separadas por vírgulas.

Testes manuais: entrar como `user@social.com` e verificar a listagem sem formulário de cadastro; sair, entrar como `admin@social.com`, registrar uma avaliação e confirmar que ela continua na lista após atualizar a página. As senhas são digitadas somente na tela de login do Auth0.
