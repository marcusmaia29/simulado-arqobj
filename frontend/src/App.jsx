import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const CLAIMS = 'https://social-insper.com/';
const formatDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
const averageFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function Icon({ name, size = 20, ...props }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    logout: <><path d="M9 4H4v16h5m6-12 4 4-4 4m-6-4h12" /></>,
    note: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6m-6 4h6m-6 4h4" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

function tokenClaims(token) {
  // These claims only control presentation. The API verifies every token and permission.
  const part = token.split('.')[1];
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function readResponse(response) {
  if (response.status === 401) throw new Error('Sua sessão expirou ou o token não é válido. Entre novamente.');
  if (response.status === 403) throw new Error('Seu usuário não tem permissão para realizar esta ação.');
  if (response.status === 400) throw new Error('Confira o e-mail, o comentário e a nota de 0 a 10.');
  if (!response.ok) throw new Error('Não foi possível concluir a solicitação. Tente novamente.');
  return response.json();
}

function initials(email = '') {
  return email.slice(0, 2).toUpperCase() || 'EQ';
}

export default function App() {
  const { isLoading: authLoading, isAuthenticated, user, error: authError, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
  const [evaluations, setEvaluations] = useState([]);
  const [roles, setRoles] = useState([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const dialog = useRef(null);
  const form = useRef(null);
  const isAdmin = roles.includes('ADMIN');
  const signIn = () => loginWithRedirect({ authorizationParams: { prompt: 'login' } }).catch(() => setError('Não foi possível abrir o login. Tente novamente.'));

  const loadEvaluations = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const token = await getAccessTokenSilently();
      if (signal?.aborted) return;
      const claims = tokenClaims(token);
      setRoles(Array.isArray(claims[`${CLAIMS}roles`]) ? claims[`${CLAIMS}roles`] : []);
      setEmail(claims[`${CLAIMS}email`] || user?.email || '');
      const response = await fetch(`${API_URL}/avaliacoes`, { headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' });
      const result = await readResponse(response);
      if (!Array.isArray(result)) throw new Error('A API retornou uma resposta inesperada.');
      if (!signal?.aborted) setEvaluations(result);
    } catch (failure) {
      if (!signal?.aborted) setError(failure.error === 'login_required' || failure.error === 'consent_required'
        ? 'Entre novamente para autorizar o acesso às avaliações.'
        : failure.message || 'Não foi possível acessar as avaliações. Tente novamente.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [getAccessTokenSilently, user?.email]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    loadEvaluations(controller.signal);
    return () => controller.abort();
  }, [isAuthenticated, loadEvaluations]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return evaluations.filter(item => [item.emailAvaliado, item.emailAvaliador, item.comentarios]
      .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term)));
  }, [evaluations, search]);
  const average = evaluations.length ? evaluations.reduce((sum, item) => sum + Number(item.nota), 0) / evaluations.length : null;
  const mine = evaluations.filter(item => item.emailAvaliador?.toLowerCase() === email.toLowerCase()).length;

  function openForm() {
    setFormError('');
    form.current?.reset();
    dialog.current.showModal();
  }

  async function createEvaluation(event) {
    event.preventDefault();
    if (submitting || !isAdmin) return;
    setSubmitting(true);
    setFormError('');
    const data = new FormData(event.currentTarget);
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_URL}/avaliacoes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailAvaliado: data.get('emailAvaliado').trim(), comentarios: data.get('comentarios').trim(), nota: Number(data.get('nota')) }),
      });
      const created = await readResponse(response);
      setEvaluations(current => [created, ...current]);
      setNotice('Avaliação registrada com sucesso.');
      dialog.current.close();
    } catch (failure) {
      setFormError(failure.message || 'Não foi possível registrar a avaliação.');
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) return <main className="loading-page"><span className="spinner" /><p>Preparando seu espaço…</p></main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Equipe, início"><span className="brand-icon">e<span>•</span></span><span>equipe<span className="brand-dot">.</span></span></a>
      <div className="workspace-label">ESPAÇO DA EQUIPE</div>
      <a className="nav-item active" href="/"><Icon name="grid" />Avaliações<Icon name="arrow" size={16} /></a>
      <div className="sidebar-bottom"><span className="small-shield"><Icon name="lock" size={17} /></span><p>Acesso seguro<br /><span>Autenticação com Auth0</span></p></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><span className="breadcrumb">Workspace <span>/</span> <strong>Avaliações</strong></span>
        {isAuthenticated ? <div className="account"><span className="avatar">{initials(email || user?.email)}</span><div><strong>{email || user?.email || 'Minha conta'}</strong><span>{isAdmin ? 'Administrador' : 'Usuário'}</span></div><button className="icon-button" title="Sair da conta" aria-label="Sair da conta" onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}><Icon name="logout" /></button></div> : <span className="topbar-label"><span className="status-dot" />Portal de avaliações</span>}
      </header>
      <main className="content">
        {!isAuthenticated ? <section className="welcome">
          <div className="welcome-copy"><div className="eyebrow"><span className="status-dot" />CRESCEMOS MELHOR JUNTOS</div><h1>Feedback que<br />vira <em>evolução.</em></h1><p>Um espaço para reconhecer entregas, compartilhar perspectivas e acompanhar as avaliações da sua equipe.</p><button className="button primary login-button" onClick={signIn}>Entrar na minha conta <Icon name="arrow" /></button><div className="login-note"><Icon name="lock" size={15} />Use sua conta para acessar as avaliações.</div>{(authError || error) && <div className="alert error" role="alert">{error || `Não foi possível concluir o login: ${authError.message}`}</div>}</div>
          <div className="welcome-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span className="art-star">✳</span><div className="art-card"><span className="art-label">CADA PERSPECTIVA CONTA</span><div className="art-quote">“</div><div className="art-lines"><i /><i /><i /></div><div className="art-people"><b>↗</b><span>Aprender.<br /><strong>Compartilhar. Evoluir.</strong></span></div></div><span className="art-tag"><Icon name="check" size={16} />Mais diálogo, mais crescimento</span></div>
        </section> : <>
          <section className="page-heading"><div><div className="eyebrow">DESENVOLVIMENTO EM EQUIPE</div><h1>Avaliações<span className="heading-dot">.</span></h1><p>Perspectivas que ajudam a construir o próximo passo.</p></div>{isAdmin && <button className="button primary" disabled={loading || !!error} onClick={openForm}><Icon name="plus" size={18} />Nova avaliação</button>}</section>
          <section className="stats" aria-label="Resumo das avaliações"><article className="stat-card"><span>Total de avaliações</span><strong>{loading && !evaluations.length ? '—' : evaluations.length}<span className="stat-symbol"><Icon name="note" size={23} /></span></strong><small>Feedbacks registrados na equipe</small></article><article className="stat-card"><span>Nota média</span><strong>{average === null ? '—' : averageFormat.format(average)}<span className="stat-scale">/ 10</span><span className="stat-symbol">↗</span></strong><small>{evaluations.length ? 'Considerando todas as avaliações' : 'Disponível após o primeiro registro'}</small></article><article className="stat-card tint"><span>Minhas avaliações</span><strong>{loading && !evaluations.length ? '—' : mine}<span className="stat-symbol">✳</span></strong><small>Feedbacks enviados por você</small></article></section>
          {notice && <div className="alert success" role="status"><Icon name="check" size={18} />{notice}<button className="icon-button" aria-label="Fechar confirmação" onClick={() => setNotice('')}><Icon name="close" size={16} /></button></div>}
          {(error || authError) && <div className="alert error" role="alert"><span>{error || authError.message}</span><button className="text-button" onClick={signIn}>Entrar novamente</button></div>}
          <section className="evaluations-panel" aria-labelledby="list-title"><div className="panel-heading"><div><h2 id="list-title">Todas as avaliações <span className="count-badge">{evaluations.length}</span></h2><p>Consulte os feedbacks e acompanhe as contribuições.</p></div><button className="icon-button refresh-button" disabled={loading} aria-label="Atualizar avaliações" title="Atualizar avaliações" onClick={() => loadEvaluations()}><Icon name="refresh" /></button></div><div className="list-toolbar"><label className="search"><Icon name="search" size={19} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por pessoa ou comentário" aria-label="Buscar avaliações" /></label><span className="list-count">{filtered.length} {filtered.length === 1 ? 'avaliação' : 'avaliações'}</span></div>
            {loading ? <div className="empty-state" role="status"><span className="spinner" /><h3>Carregando avaliações</h3><p>Buscando os feedbacks da equipe.</p></div> : error ? <div className="empty-state"><Icon name="refresh" size={32} /><h3>Vamos tentar novamente?</h3><p>As avaliações não puderam ser carregadas.</p><button className="button secondary" onClick={() => loadEvaluations()}>Tentar novamente</button></div> : !filtered.length ? <div className="empty-state"><span className="empty-icon"><Icon name={search ? 'search' : 'note'} size={29} /></span><h3>{search ? 'Nenhuma avaliação encontrada' : 'Toda evolução começa com uma conversa.'}</h3><p>{search ? 'Tente outro nome, e-mail ou comentário.' : isAdmin ? 'Registre o primeiro feedback e dê início às avaliações da equipe.' : 'As avaliações aparecerão aqui assim que forem registradas.'}</p>{isAdmin && !search && <button className="button secondary" onClick={openForm}><Icon name="plus" size={17} />Criar primeira avaliação</button>}</div> : <div className="evaluation-list">{filtered.map(item => <article className="evaluation" key={item.id}><div className="evaluation-person"><span className="person-avatar">{initials(item.emailAvaliado)}</span><div><span className="field-label">PESSOA AVALIADA</span><h3>{item.emailAvaliado}</h3></div><div className={`grade ${item.nota < 6 ? 'moderate' : ''}`}><strong>{item.nota}</strong><span>/10</span></div></div><p className="comment">{item.comentarios}</p><div className="evaluation-footer"><span>Por <strong>{item.emailAvaliador}</strong></span><time dateTime={item.dataAvaliacao}>{formatDate.format(new Date(item.dataAvaliacao))}</time></div></article>)}</div>}
          </section>{!isAdmin && <p className="permission-note"><Icon name="lock" size={15} />Você pode consultar as avaliações. O cadastro está disponível para administradores.</p>}
        </>}
        <footer className="footer"><span>Equipe · Sistema de avaliações</span><span>Clareza para evoluir, juntos.</span></footer>
      </main>
    </div>
    <dialog ref={dialog} className="evaluation-dialog" onCancel={event => { if (submitting) event.preventDefault(); }}><form ref={form} onSubmit={createEvaluation}><div className="dialog-heading"><div><div className="eyebrow">UM NOVO PONTO DE VISTA</div><h2>Nova avaliação</h2></div><button type="button" className="icon-button" disabled={submitting} aria-label="Fechar formulário" onClick={() => dialog.current.close()}><Icon name="close" /></button></div><p className="dialog-intro">Compartilhe um feedback claro e construtivo.</p><label className="form-label" htmlFor="avaliado">E-mail da pessoa avaliada</label><input id="avaliado" name="emailAvaliado" type="email" maxLength={254} placeholder="pessoa@empresa.com" required autoComplete="off" /><label className="form-label" htmlFor="nota">Nota <span>De 0 a 10</span></label><select id="nota" name="nota" defaultValue="" required><option value="" disabled>Selecione uma nota</option>{Array.from({ length: 11 }, (_, index) => <option key={index} value={index}>{index}</option>)}</select><label className="form-label" htmlFor="comentarios">Comentário</label><textarea id="comentarios" name="comentarios" required maxLength={4000} rows={4} placeholder="O que você gostaria de destacar?" /><p className="form-note"><Icon name="lock" size={14} />O feedback será registrado com seu e-mail.</p>{formError && <div className="alert error" role="alert">{formError}</div>}<div className="dialog-actions"><button type="button" className="button secondary" disabled={submitting} onClick={() => dialog.current.close()}>Cancelar</button><button className="button primary" type="submit" disabled={submitting}>{submitting ? 'Registrando…' : 'Registrar avaliação'}{!submitting && <Icon name="arrow" size={18} />}</button></div></form></dialog>
  </div>;
}
