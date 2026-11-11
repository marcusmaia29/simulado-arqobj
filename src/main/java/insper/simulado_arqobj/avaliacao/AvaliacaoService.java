package insper.simulado_arqobj.avaliacao;

import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AvaliacaoService {
    private final AvaliacaoRepository repository;

    public AvaliacaoService(AvaliacaoRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<Avaliacao> listar() {
        return repository.findAll(Sort.by(Sort.Direction.DESC, "dataAvaliacao", "id"));
    }

    @Transactional
    public Avaliacao cadastrar(String emailAvaliador, CriarAvaliacaoRequest request) {
        return repository.save(new Avaliacao(emailAvaliador, request));
    }
}
