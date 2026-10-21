/*
 * Author: Roberto Ritter
 * Studio: Cube4Code
 * Website: https://cube4code.com
 * Copyright (c) 2026 Roberto Ritter
 *
 * Conjuntos prontos de modelos (Trabalho, Pessoal, Leituras, Estudos, Software, Jogos). Aplicar um conjunto
 * só cria notas comuns na pasta modelos/ do vault; depois elas são do usuário, para mudar como quiser.
 */
import { serializeProps } from './props';
import { TEMPLATE_DIR } from './tipos';

interface Def { name: string; tipo: string; destino: string; tags?: string[]; fields: string[]; sections: string[]; date?: boolean; }
interface Kit { id: string; icon: string; name: string; description: string; templates: Def[]; }

const pt: Kit[] = [
  { id: 'trabalho', icon: 'Briefcase', name: 'Trabalho', description: 'Empresas, pessoas, reuniões, projetos e decisões', templates: [
    { name: 'Empresa', tipo: 'empresa', destino: 'Empresas', tags: ['empresa'], fields: ['ramo', 'site'], sections: ['O que faz', 'Contatos', 'Histórico'] },
    { name: 'Pessoa', tipo: 'pessoa', destino: 'Pessoas', tags: ['pessoa'], fields: ['empresa', 'cargo', 'email', 'telefone'], sections: ['Contexto', 'Conversas'] },
    { name: 'Reunião', tipo: 'reunião', destino: 'Reuniões', tags: ['reunião'], date: true, fields: ['participantes', 'empresa'], sections: ['Pauta', 'Anotações', 'Decisões', 'Próximos passos'] },
    { name: 'Projeto', tipo: 'projeto', destino: 'Projetos', tags: ['projeto'], fields: ['status', 'empresa', 'responsável'], sections: ['Objetivo', 'Escopo', 'Andamento'] },
    { name: 'Decisão', tipo: 'decisão', destino: 'Decisões', tags: ['decisão'], date: true, fields: ['projeto', 'status'], sections: ['Contexto', 'Decisão', 'Alternativas', 'Consequências'] },
    { name: 'Diário', tipo: 'diário', destino: 'Diário', fields: [], sections: ['Hoje', 'Anotações'] },
  ] },
  { id: 'pessoal', icon: 'House', name: 'Pessoal', description: 'Diário, ideias, listas e lugares', templates: [
    { name: 'Diário', tipo: 'diário', destino: 'Diário', fields: ['humor'], sections: ['Hoje', 'Gratidão', 'Anotações'] },
    { name: 'Ideia', tipo: 'ideia', destino: 'Ideias', tags: ['ideia'], fields: ['status'], sections: ['A ideia', 'Por que importa', 'Próximo passo'] },
    { name: 'Lista', tipo: 'lista', destino: 'Listas', fields: [], sections: ['Itens'] },
    { name: 'Lugar', tipo: 'lugar', destino: 'Lugares', fields: ['cidade', 'endereço', 'site'], sections: ['Por que ir', 'Visitas'] },
  ] },
  { id: 'leituras', icon: 'BookOpen', name: 'Leituras', description: 'Livros, autores e conceitos', templates: [
    { name: 'Livro', tipo: 'livro', destino: 'Livros', tags: ['livro'], fields: ['autor', 'ano', 'status', 'nota'], sections: ['Resumo', 'Trechos', 'O que levo'] },
    { name: 'Autor', tipo: 'autor', destino: 'Autores', fields: ['nacionalidade'], sections: ['Quem é', 'Obras'] },
    { name: 'Conceito', tipo: 'conceito', destino: 'Conceitos', fields: [], sections: ['Definição', 'Onde aparece'] },
  ] },
  { id: 'estudos', icon: 'GraduationCap', name: 'Estudos', description: 'Disciplinas, aulas, conceitos e referências', templates: [
    { name: 'Disciplina', tipo: 'disciplina', destino: 'Disciplinas', fields: ['professor', 'semestre'], sections: ['Ementa', 'Avaliações'] },
    { name: 'Aula', tipo: 'aula', destino: 'Aulas', date: true, fields: ['disciplina'], sections: ['Assuntos', 'Anotações', 'Dúvidas'] },
    { name: 'Conceito', tipo: 'conceito', destino: 'Conceitos', fields: ['disciplina'], sections: ['Definição', 'Exemplos'] },
    { name: 'Referência', tipo: 'referência', destino: 'Referências', fields: ['autor', 'link'], sections: ['Resumo', 'Citações'] },
  ] },
  { id: 'software', icon: 'Code', name: 'Projetos de software', description: 'Projetos, decisões, tarefas e notas técnicas', templates: [
    { name: 'Projeto', tipo: 'projeto', destino: 'Projetos', fields: ['repositório', 'status'], sections: ['Visão', 'Arquitetura', 'Pendências'] },
    { name: 'Decisão', tipo: 'decisão', destino: 'Decisões', date: true, fields: ['projeto', 'status'], sections: ['Contexto', 'Decisão', 'Alternativas', 'Consequências'] },
    { name: 'Tarefa', tipo: 'tarefa', destino: 'Tarefas', fields: ['projeto', 'status', 'prazo'], sections: ['O que fazer', 'Critério de pronto'] },
    { name: 'Nota técnica', tipo: 'nota técnica', destino: 'Notas técnicas', fields: ['projeto'], sections: ['Problema', 'Solução'] },
  ] },
  { id: 'jogos', icon: 'Dices', name: 'Jogos de tabuleiro', description: 'Jogos, designers, mecânicas e partidas', templates: [
    { name: 'Jogo', tipo: 'jogo', destino: 'Jogos', fields: ['designer', 'jogadores', 'duração', 'mecânicas'], sections: ['Impressões', 'Regras que esqueço'] },
    { name: 'Designer', tipo: 'designer', destino: 'Designers', fields: [], sections: ['Jogos'] },
    { name: 'Mecânica', tipo: 'mecânica', destino: 'Mecânicas', fields: [], sections: ['Como funciona'] },
    { name: 'Partida', tipo: 'partida', destino: 'Partidas', date: true, fields: ['jogo', 'jogadores', 'vencedor'], sections: ['Placar', 'Momentos'] },
  ] },
];

const en: Kit[] = [
  { id: 'trabalho', icon: 'Briefcase', name: 'Work', description: 'Companies, people, meetings, projects and decisions', templates: [
    { name: 'Company', tipo: 'company', destino: 'Companies', tags: ['company'], fields: ['industry', 'website'], sections: ['What they do', 'Contacts', 'History'] },
    { name: 'Person', tipo: 'person', destino: 'People', tags: ['person'], fields: ['company', 'role', 'email', 'phone'], sections: ['Context', 'Conversations'] },
    { name: 'Meeting', tipo: 'meeting', destino: 'Meetings', tags: ['meeting'], date: true, fields: ['attendees', 'company'], sections: ['Agenda', 'Notes', 'Decisions', 'Next steps'] },
    { name: 'Project', tipo: 'project', destino: 'Projects', tags: ['project'], fields: ['status', 'company', 'owner'], sections: ['Goal', 'Scope', 'Progress'] },
    { name: 'Decision', tipo: 'decision', destino: 'Decisions', tags: ['decision'], date: true, fields: ['project', 'status'], sections: ['Context', 'Decision', 'Alternatives', 'Consequences'] },
    { name: 'Journal', tipo: 'journal', destino: 'Journal', fields: [], sections: ['Today', 'Notes'] },
  ] },
  { id: 'pessoal', icon: 'House', name: 'Personal', description: 'Journal, ideas, lists and places', templates: [
    { name: 'Journal', tipo: 'journal', destino: 'Journal', fields: ['mood'], sections: ['Today', 'Gratitude', 'Notes'] },
    { name: 'Idea', tipo: 'idea', destino: 'Ideas', tags: ['idea'], fields: ['status'], sections: ['The idea', 'Why it matters', 'Next step'] },
    { name: 'List', tipo: 'list', destino: 'Lists', fields: [], sections: ['Items'] },
    { name: 'Place', tipo: 'place', destino: 'Places', fields: ['city', 'address', 'website'], sections: ['Why go', 'Visits'] },
  ] },
  { id: 'leituras', icon: 'BookOpen', name: 'Reading', description: 'Books, authors and concepts', templates: [
    { name: 'Book', tipo: 'book', destino: 'Books', tags: ['book'], fields: ['author', 'year', 'status', 'rating'], sections: ['Summary', 'Quotes', 'Takeaways'] },
    { name: 'Author', tipo: 'author', destino: 'Authors', fields: ['nationality'], sections: ['Who they are', 'Works'] },
    { name: 'Concept', tipo: 'concept', destino: 'Concepts', fields: [], sections: ['Definition', 'Where it appears'] },
  ] },
  { id: 'estudos', icon: 'GraduationCap', name: 'Studies', description: 'Courses, lectures, concepts and references', templates: [
    { name: 'Course', tipo: 'course', destino: 'Courses', fields: ['teacher', 'term'], sections: ['Syllabus', 'Assessments'] },
    { name: 'Lecture', tipo: 'lecture', destino: 'Lectures', date: true, fields: ['course'], sections: ['Topics', 'Notes', 'Questions'] },
    { name: 'Concept', tipo: 'concept', destino: 'Concepts', fields: ['course'], sections: ['Definition', 'Examples'] },
    { name: 'Reference', tipo: 'reference', destino: 'References', fields: ['author', 'link'], sections: ['Summary', 'Quotes'] },
  ] },
  { id: 'software', icon: 'Code', name: 'Software projects', description: 'Projects, decisions, tasks and tech notes', templates: [
    { name: 'Project', tipo: 'project', destino: 'Projects', fields: ['repository', 'status'], sections: ['Vision', 'Architecture', 'Open items'] },
    { name: 'Decision', tipo: 'decision', destino: 'Decisions', date: true, fields: ['project', 'status'], sections: ['Context', 'Decision', 'Alternatives', 'Consequences'] },
    { name: 'Task', tipo: 'task', destino: 'Tasks', fields: ['project', 'status', 'due'], sections: ['What to do', 'Definition of done'] },
    { name: 'Tech note', tipo: 'tech note', destino: 'Tech notes', fields: ['project'], sections: ['Problem', 'Solution'] },
  ] },
  { id: 'jogos', icon: 'Dices', name: 'Board games', description: 'Games, designers, mechanics and plays', templates: [
    { name: 'Game', tipo: 'game', destino: 'Games', fields: ['designer', 'players', 'length', 'mechanics'], sections: ['Impressions', 'Rules I forget'] },
    { name: 'Designer', tipo: 'designer', destino: 'Designers', fields: [], sections: ['Games'] },
    { name: 'Mechanic', tipo: 'mechanic', destino: 'Mechanics', fields: [], sections: ['How it works'] },
    { name: 'Play', tipo: 'play', destino: 'Plays', date: true, fields: ['game', 'players', 'winner'], sections: ['Score', 'Moments'] },
  ] },
];

export function kits(lang: string): Kit[] { return lang === 'pt-BR' ? pt : en; }
const words = (lang: string) => (lang === 'pt-BR' ? { type: 'tipo', folder: 'destino', date: 'data', dateVar: '{{data}}' } : { type: 'type', folder: 'folder', date: 'date', dateVar: '{{date}}' });

// Notas de um conjunto: modelos/<Nome>.md com tipo, destino, tags, campos vazios e seções
// (palavras-chave na língua da interface: tipo/destino/data ou type/folder/date).
export function kitNotes(kit: Kit, lang: string): { path: string; content: string }[] {
  const w = words(lang);
  return kit.templates.map(d => {
    const props = [
      { key: w.type, value: d.tipo },
      { key: w.folder, value: d.destino },
      ...(d.tags?.length ? [{ key: 'tags', value: d.tags }] : []),
      ...(d.date ? [{ key: w.date, value: w.dateVar }] : []),
      ...d.fields.map(f => ({ key: f, value: '' })),
    ];
    // sem título no corpo: o nome da nota já aparece no alto
    const body = d.sections.map(s => `## ${s}\n\n`).join('');
    return { path: `${TEMPLATE_DIR}/${d.name}.md`, content: serializeProps(props) + body };
  });
}
