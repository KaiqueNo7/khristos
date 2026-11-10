import { card } from './engine.js';

const TYPE_NAME = { Unidade: 'Unidade', Monumento: 'Monumento', Santo: 'Santo', 'Relíquia': 'Relíquia', Bencao: 'Bênção', Heresia: 'Heresia' };
const FEMININE = new Set(['Unidade', 'Relíquia', 'Bencao', 'Heresia']);
const RARITY = { Comum: ['comum', 'comum'], Raro: ['raro', 'rara'], 'Épico': ['épico', 'épica'], 'Lendário': ['lendário', 'lendária'] };

export const typeName = def => TYPE_NAME[def.type];
export const kindLabel = def => `${TYPE_NAME[def.type]} ${RARITY[def.sub][FEMININE.has(def.type) ? 1 : 0]}`;

const GLYPHS = {
  cloak: '<path d="M50 12c-14 0-24 10-26 24L16 86h68l-8-50c-2-14-12-24-26-24z"/><path d="M50 12v74"/>',
  book: '<path d="M50 28c-10-8-24-8-34-4v48c10-4 24-4 34 4 10-8 24-8 34-4V24c-10-4-24-4-34 4z"/><path d="M50 28v48"/>',
  casket: '<path d="M22 46h56v36H22z"/><path d="M22 46l10-18h36l10 18"/><path d="M50 28V14M43 20h14M50 56v14M43 63h14"/>',
  banner: '<path d="M30 10v80"/><path d="M30 16h46L64 33l12 17H30"/>',
  shield: '<path d="M50 12l32 10v24c0 22-14 36-32 44-18-8-32-22-32-44V22z"/><path d="M50 30v40M36 46h28"/>',
  frame: '<rect x="24" y="14" width="52" height="72" rx="4"/><circle cx="50" cy="42" r="12"/><path d="M34 76c2-12 10-18 16-18s14 6 16 18"/>',
  flame: '<path d="M50 12c12 14 18 24 18 36a18 18 0 0 1-36 0c0-8 4-14 8-18 2 6 6 8 8 8-2-10-2-18 2-26z"/><path d="M36 86h28"/>',
  sun: '<circle cx="50" cy="50" r="14"/><path d="M50 12v14M50 74v14M12 50h14M74 50h14M23 23l10 10M67 67l10 10M77 23L67 33M33 67L23 77"/>',
  chirho: '<path d="M50 10v80"/><path d="M50 10c24 0 24 32 0 32"/><path d="M22 36l56 46M78 36L22 82"/>',
  note: '<path d="M38 70V22l34-8v48"/><circle cx="30" cy="72" r="9"/><circle cx="64" cy="64" r="9"/>',
  sword: '<path d="M50 10v58M34 60h32M50 68v20M43 88h14"/><path d="M50 10l-7 13M50 10l7 13"/>',
  scales: '<path d="M50 14v70M30 84h40M22 28h56"/><path d="M22 28L10 54h24zM78 28L66 54h24z"/>',
  eye: '<path d="M12 50c12-18 26-26 38-26s26 8 38 26c-12 18-26 26-38 26S24 68 12 50z"/><circle cx="50" cy="50" r="11"/>',
  coins: '<circle cx="38" cy="60" r="18"/><circle cx="62" cy="40" r="18"/><path d="M62 32v16M38 52v16"/>',
  crack: '<path d="M58 8L38 40l20 8-24 44"/><path d="M26 22l10 12M74 58l-12 8"/>',
  horn: '<path d="M18 42v16l14 4 34 18V20L32 38z"/><path d="M76 38c6 4 6 20 0 24"/>',
  altar: '<path d="M18 40h64M26 40v44M74 40v44M18 84h64"/><path d="M52 40l-8 16 12 6-8 22"/><path d="M50 12v20M41 21h18"/>',
  drop: '<path d="M50 10c14 20 24 34 24 48a24 24 0 0 1-48 0c0-14 10-28 24-48z"/><path d="M40 60a11 11 0 0 0 10 12"/>',
  apple: '<path d="M50 32c-16-9-30 3-30 22 0 18 14 34 30 34s30-16 30-34c0-19-14-31-30-22z"/><path d="M50 32c0-9 4-15 11-19"/>',
  palm: '<path d="M50 92V28"/><path d="M50 28c-9-5-15-12-17-20M50 28c9-5 15-12 17-20M50 44c-12-4-20-10-24-19M50 44c12-4 20-10 24-19M50 60c-12-3-21-9-27-17M50 60c12-3 21-9 27-17"/>',
  dove: '<path d="M14 44c14-2 24 4 30 14 4-18 16-30 36-34-6 8-8 16-8 26 0 18-12 30-28 30-12 0-22-8-24-20 6 2 10 2 14 0-10-2-17-8-20-16z"/>'
};

const GLYPH_OF = {
  manto: 'cloak', livro: 'book', relicario: 'casket', estandarte: 'banner', armadura: 'shield', icone: 'frame',
  vesperas: 'flame', consagracao: 'sun', ordenacao: 'chirho', louvor: 'note', cruzada: 'sword',
  debate: 'scales', exposicao_aq: 'eye', exposicao_jo: 'eye', simonia: 'coins', heresia_alb: 'crack',
  iconoclastia: 'frame', acusacao: 'flame', propaganda: 'horn', profanacao: 'altar',
  crisma: 'dove', uncao: 'drop', graca: 'sun', te_deum: 'note', tentacao: 'apple', escandalo: 'eye', cisma: 'crack',
  catecumeno: 'book', martir: 'palm', inquisicao: 'scales'
};

const FALLBACK = { Unidade: 'chirho', Monumento: 'altar', Santo: 'sun', 'Relíquia': 'casket', Bencao: 'sun', Heresia: 'crack' };

export function artHtml(def, cls) {
  if (def.backgroundImage) return `<div class="${cls}" style="background-image:url('${def.backgroundImage}')"></div>`;
  const glyph = GLYPHS[GLYPH_OF[def.id] || FALLBACK[def.type]];
  return `<div class="${cls} glyph"><svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg></div>`;
}

const LEADS = /(Passiva:|Ativo(?: \([^)]*\))?:|Vocação:|Requisito:|Ao entrar em campo:|Fervor:|Sacramento:)/g;
export const richText = text => text.replace(LEADS, '<b>$1</b>');

export function cardNode(def, { cost = def.cost, width = null } = {}) {
  const node = document.createElement('div');
  node.className = `card t-${def.type} r-${def.sub}`;
  if (width) node.style.setProperty('--w', `${width}px`);
  const body = def.type === 'Unidade' || def.type === 'Santo' || def.type === 'Monumento';
  node.innerHTML = `
    ${artHtml(def, 'card__art')}
    <div class="card__cost${cost < def.cost ? ' cheap' : ''}">${cost}</div>
    ${def.evolvesFrom ? `<div class="card__evo">sobre ${card(def.evolvesFrom).name}</div>` : ''}
    <div class="card__name">${def.name}</div>
    <div class="card__body"><div class="card__kind">${kindLabel(def)}</div><div class="card__text${def.effect.length > 150 ? ' long' : ''}">${richText(def.effect)}</div></div>
    ${body ? `<div class="card__fe">${def.fe}</div>` : ''}
    <div class="card__gem"></div>
    ${body && def.type !== 'Monumento' ? `<div class="card__fraq">${def.fraq}</div>` : ''}`;
  return node;
}

export function boardCardNode(c) {
  const def = card(c.id);
  const node = document.createElement('div');
  node.className = `bcard t-${def.type}`;
  node.dataset.uid = c.uid;
  node.innerHTML = `
    <div class="bcard__in">${artHtml(def, 'bcard__art')}</div>
    <div class="bcard__marks"></div>
    <div class="bcard__pips"></div>
    <div class="bcard__office"></div>
    <div class="bcard__name">${def.name}</div>
    <div class="stat stat--fe"></div>
    ${def.type === 'Monumento' ? '' : '<div class="stat stat--fraq"></div>'}`;
  return node;
}

export function backNode() {
  const node = document.createElement('div');
  node.className = 'back';
  return node;
}
