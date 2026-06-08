import * as strategicNoteRepo from "../repos/strategicNoteRepo.js";

export async function listStrategicNotes() {
  return strategicNoteRepo.listStrategicNotes();
}

export async function deleteStrategicNote(id: string) {
  await strategicNoteRepo.deleteStrategicNote(id);
}
