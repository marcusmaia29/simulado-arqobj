package insper.simulado_arqobj.avaliacao;

import java.time.Instant;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "avaliacoes")
@Getter
@NoArgsConstructor
public class Avaliacao {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 254)
    private String emailAvaliador;

    @Column(nullable = false, length = 254)
    private String emailAvaliado;

    @Column(nullable = false, length = 4000)
    private String comentarios;

    @Column(nullable = false)
    private Integer nota;

    @Column(nullable = false)
    private Instant dataAvaliacao;

    public Avaliacao(String emailAvaliador, CriarAvaliacaoRequest request) {
        this.emailAvaliador = emailAvaliador;
        this.emailAvaliado = request.emailAvaliado();
        this.comentarios = request.comentarios();
        this.nota = request.nota();
        this.dataAvaliacao = Instant.now();
    }
}
