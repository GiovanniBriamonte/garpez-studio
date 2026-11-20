/*
 * Everything the ABOUT channel says and shows. This is draft copy: names, roles, skills,
 * lines and mail addresses are placeholders to rewrite.
 *
 * Models go in /public/about. A character whose file is missing shows up as a block mannequin.
 */

export const CREW = [
  {
    name: "GAR",
    role: "ART DIRECTOR",
    tagline: "Make the logo smaller.",
    /* label, value 0-100 */
    skills: [
      ["TASTE", 96],
      ["KERNING", 99],
      ["PATIENCE", 31],
      ["SMILING", 8],
    ],
    email: "hello@garpez.studio",
    model: "p1.glb",
    /* Exact clip names inside the model. Leave empty to auto-detect: the idle is the clip named like
       idle/breath/stand (else the first one), the select is one named like select/cheer/victory/win/
       wave/thumb/jump/dance (else any other clip; with none, the character just hops). */
    clips: { idle: "", select: "" },
    /* Optional second file, for tools that export one animation per file: its first clip becomes the select. */
    selectModel: "",
    talk: {
      intro: "You picked me. Bold. I'm GAR. I make things look expensive and I rarely smile about it.",
      who: "We're Garpez, a branding studio. Two people, one television, zero account managers.",
      what: "Identities, logos, type, motion. Everything a brand needs to stop looking like its competitors.",
      work: "Good. Tell me about your brand. I answer faster than I smile.",
      mailed: "Mail's open. If nothing happened, write to {email} and I'll pretend I didn't notice.",
    },
  },
  {
    name: "PEZ",
    role: "BRAND STRATEGIST",
    tagline: "Trust me, it's a concept.",
    skills: [
      ["IDEAS", 95],
      ["CHARISMA", 91],
      ["DEADLINES", 44],
      ["HANDS IN POCKETS", 100],
    ],
    email: "hello@garpez.studio",
    model: "p2.glb",
    clips: { idle: "", select: "" },
    selectModel: "",
    talk: {
      intro: "Great choice! I'm PEZ. I ask 'why' until the brand finally makes sense.",
      who: "Garpez is a branding studio. He frowns at the kerning, I talk to humans. Somehow it works.",
      what: "Strategy, naming, identity, and the occasional television you can play with. You're inside one.",
      work: "Love that. Tell me what you're building and I'll bring the ideas. And the other guy.",
      mailed: "Mail's open! If nothing happened, write to {email}. I check it between two coffees.",
    },
  },
];

export const COPY = {
  loading: "NOW LOADING",
  title: "GARPEZ",
  subtitle: "ABOUT US: THE GAME",
  start: "PRESS START",
  startTouch: "TAP TO START",
  footer: "2 PLAYERS. BOTH OURS.",
  choose: "CHOOSE YOUR GARPEZ",
  /* key prompts under the character select: the keys, then what they do ("<" and ">" draw as arrows) */
  hints: [
    [["<", ">"], "CHOOSE"],
    [["ENTER"], "SELECT"],
    [["ESC"], "BACK"],
  ],
  hintTouch: "TAP TO CHOOSE, TAP AGAIN TO SELECT",
  ready: "READY!",
  prompt: "What do you want to know?",
  /* the dialogue menu, in reading order; `back` returns to the character select */
  menu: [
    ["who", "WHO ARE YOU?"],
    ["what", "WHAT DO YOU DO?"],
    ["work", "LET'S WORK TOGETHER"],
    ["back", "BACK"],
  ],
  mailSubject: "New mission for {name}",
  mailBody: "Hi {name},\n\nI picked you on channel 4. Here's what I'm building:\n\n",
};
