package insper.simulado_arqobj.avaliacao;

import jakarta.validation.constraints.*;

public record CriarAvaliacaoRequest(
        @NotBlank @Email @Size(max = 254) String emailAvaliado,
        @NotBlank @Size(max = 4000) String comentarios,
        @NotNull @Min(0) @Max(10) Integer nota) {
}
