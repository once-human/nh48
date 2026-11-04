// no home in /beta: Onkar will bring it back with the story, built from scratch. Nothing is drawn, nothing marked,
// no door to walk up to; the yard's saved parking is left alone in the save
export class Home {
  constructor(G) { this.g = G; this.at = null; this.group = null; this.door = null; }
  update() {}
  near() { return null; }
  use() {}
  bayOf() { return null; }
  parkTick() {}
  restoreParked() {}
  markers() { return []; }
  spot() { return null; }
}
