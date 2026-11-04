// /beta has no story: no acts, no missions, no cutscenes. This stands in for src/game/story.js and answers
// "nothing" to everything the rest of the game asks the story (the map, the phone, the diary, the shops).
export class Story {
  constructor(G) { this.g = G; this.on = false; this.talking = false; this.st = { m: -1, step: -1 }; this.flags = {}; }
  update() {}
  cam() {}
  objective() { return null; }
  mission() { return null; }
  target() { return null; }
  trackNow() { return null; }
  markers() { return []; }
  list() { return []; }
  summary() { return []; }
  near() { return null; }
  use() {}
  label() { return ''; }
  name(who) { return who; }
  showMarker() {}
  hideMarker() {}
  onPhoto() {}
}
