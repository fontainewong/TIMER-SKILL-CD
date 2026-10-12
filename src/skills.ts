export const SKILLS = [
  { id: 'blink', name: '閃現', initial: 60, cooldown: 150, symbol: '↯', color: '#bca3ef' },
  { id: 'warp', name: '移形', initial: 50, cooldown: 100, symbol: '◇', color: '#8abce8' },
  { id: 'excitement', name: '興奮', initial: 40, cooldown: 100, symbol: '✦', color: '#e6bb77' },
  { id: 'patroller', name: '放狗', initial: 30, cooldown: 90, symbol: '⌁', color: '#a6c890' },
  { id: 'abnormal', name: '失常', initial: 40, cooldown: 90, symbol: '⊗', color: '#e39791' },
  { id: 'teleport', name: '傳送', initial: 45, cooldown: 100, symbol: '◎', color: '#73c8c2' },
] as const;

export type SkillId = typeof SKILLS[number]['id'];
export const skillById = (id: SkillId) => SKILLS.find(skill => skill.id === id)!;
