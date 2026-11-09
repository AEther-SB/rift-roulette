export const ROLES = [
  { id: 'TOP', label: 'Top', subtitle: 'Corsia superiore', icon: 'crown' },
  { id: 'JUNGLE', label: 'Jungle', subtitle: 'Giungla', icon: 'trees' },
  { id: 'MID', label: 'Mid', subtitle: 'Corsia centrale', icon: 'swords' },
  { id: 'ADC', label: 'ADC', subtitle: 'Tiratore', icon: 'crosshair' },
  { id: 'SUPPORT', label: 'Support', subtitle: 'Supporto', icon: 'shield' },
];

export const ROLE_IDS = ROLES.map((r) => r.id);

export const ACCENTS = ['#69d4d1', '#c8a46c', '#aa98ee', '#e08f93', '#81b9f4', '#9ac88d', '#dfb88b'];

const DISPLAY_NAMES = {
  AurelionSol: 'Aurelion Sol', Belveth: "Bel’Veth", Chogath: "Cho’Gath", DrMundo: 'Dr. Mundo',
  JarvanIV: 'Jarvan IV', Kaisa: "Kai’Sa", KaiSa: "Kai’Sa", Khazix: "Kha’Zix",
  KogMaw: "Kog’Maw", Leblanc: 'LeBlanc', LeeSin: 'Lee Sin', MasterYi: 'Master Yi',
  MissFortune: 'Miss Fortune', MonkeyKing: 'Wukong', Nunu: 'Nunu e Willump',
  RekSai: "Rek’Sai", Renata: 'Renata Glasc', TahmKench: 'Tahm Kench',
  TwistedFate: 'Twisted Fate', Velkoz: "Vel’Koz", XinZhao: 'Xin Zhao',
};

const FALLBACK_IDS = `
Aatrox Ahri Akali Akshan Alistar Ambessa Amumu Anivia Annie Aphelios Ashe AurelionSol Aurora Azir
Bard Belveth Blitzcrank Brand Braum Briar Caitlyn Camille Cassiopeia Chogath Corki
Darius Diana Draven DrMundo Ekko Elise Evelynn Ezreal Fiddlesticks Fiora Fizz
Galio Gangplank Garen Gnar Gragas Graves Gwen Hecarim Heimerdinger Hwei
Illaoi Irelia Ivern Janna JarvanIV Jax Jayce Jhin Jinx Kaisa Kalista Karma Karthus Kassadin Katarina Kayle Kayn Kennen Khazix Kindred Kled KogMaw
Leblanc LeeSin Leona Lillia Lissandra Lucian Lulu Lux
Malphite Malzahar Maokai MasterYi Mel Milio MissFortune MonkeyKing Mordekaiser Morgana
Naafiri Nami Nasus Nautilus Neeko Nidalee Nilah Nocturne Nunu
Olaf Orianna Ornn Pantheon Poppy Pyke Qiyana Quinn Rakan Rammus RekSai Rell Renata Rengar Riven Rumble Ryze
Samira Sejuani Senna Seraphine Sett Shaco Shen Shyvana Singed Sion Sivir Skarner Smolder Sona Soraka Swain Sylas Syndra
TahmKench Taliyah Talon Taric Teemo Thresh Tristana Trundle Tryndamere TwistedFate Twitch
Udyr Urgot Varus Vayne Veigar Velkoz Vex Vi Viego Viktor Vladimir Volibear
Warwick Xayah Xerath XinZhao Yasuo Yone Yorick Yuumi Yunara Zac Zaahen Zed Zeri Ziggs Zilean Zoe Zyra
`.trim().split(/\s+/);

export const FALLBACK_CHAMPIONS = FALLBACK_IDS.map((id) => ({
  id,
  name: DISPLAY_NAMES[id] ?? id,
  image: `${id}.png`,
})).sort((a, b) => a.name.localeCompare(b.name, 'it'));

export const DEFAULT_PLAYERS = [
  {
    id: 'calo', name: 'Calo', accent: ACCENTS[0],
    pools: {
      TOP: ['Aatrox', 'Sett', 'Garen'], JUNGLE: ['Viego', 'LeeSin', 'Warwick'],
      MID: ['Ahri', 'Yasuo', 'Syndra'], ADC: ['Jinx', 'Caitlyn', 'Ezreal'],
      SUPPORT: ['Thresh', 'Nautilus', 'Lux'],
    },
  },
  {
    id: 'aria', name: 'Aria', accent: ACCENTS[1],
    pools: {
      TOP: ['Fiora', 'Gwen', 'Camille'], JUNGLE: ['Diana', 'Lillia', 'Kindred'],
      MID: ['Orianna', 'Aurora', 'Lux'], ADC: ['Kaisa', 'Xayah', 'MissFortune'],
      SUPPORT: ['Seraphine', 'Lulu', 'Nami'],
    },
  },
  {
    id: 'nox', name: 'Nox', accent: ACCENTS[2],
    pools: {
      TOP: ['Darius', 'Mordekaiser', 'Malphite'], JUNGLE: ['Kayn', 'MasterYi', 'Amumu'],
      MID: ['Sylas', 'Viktor', 'Veigar'], ADC: ['Jhin', 'Varus', 'Ashe'],
      SUPPORT: ['Rakan', 'Leona', 'Braum'],
    },
  },
];

export function blankPools() {
  return Object.fromEntries(ROLE_IDS.map((role) => [role, []]));
}

export function getChampById(id, champions) {
  return champions.find((champ) => champ.id === id)
    ?? FALLBACK_CHAMPIONS.find((champ) => champ.id === id)
    ?? { id, name: id, image: `${id}.png` };
}

export function championImageUrl(champion, version) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${encodeURIComponent(champion.image || `${champion.id}.png`)}`;
}

export function countSelected(player) {
  return ROLE_IDS.reduce((sum, role) => sum + (player.pools[role]?.length || 0), 0);
}

export function countFilledRoles(player) {
  return ROLE_IDS.filter((role) => player.pools[role]?.length > 0).length;
}
