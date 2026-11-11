# simulado-arqobj

Java 25, Spring Boot 4.1.2 e PostgreSQL. A configuração do Auth0 fica para a próxima etapa.

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
