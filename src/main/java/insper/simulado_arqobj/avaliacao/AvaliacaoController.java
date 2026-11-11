package insper.simulado_arqobj.avaliacao;

import java.util.List;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import insper.simulado_arqobj.security.WebSecurityConfig;

@RestController
@RequestMapping("/avaliacoes")
public class AvaliacaoController {
    private final AvaliacaoService service;

    public AvaliacaoController(AvaliacaoService service) {
        this.service = service;
    }

    @GetMapping
    public List<Avaliacao> listar() {
        return service.listar();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Avaliacao cadastrar(@AuthenticationPrincipal Jwt jwt,
                              @Valid @RequestBody CriarAvaliacaoRequest request) {
        String email = jwt.getClaimAsString(WebSecurityConfig.EMAIL_CLAIM);
        if (email == null || email.isBlank() || email.length() > 254) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Token sem email do avaliador");
        }
        return service.cadastrar(email, request);
    }
}
