import * as incidentRepo from "../repos/incidentRepo.js";

export async function listIncidents(status?: incidentRepo.IncidentStatus | "all") {
  return incidentRepo.listIncidents({ status: status ?? "all" });
}

export async function resolveIncident(id: string, resolution?: string) {
  return incidentRepo.resolveIncident(id, resolution);
}

export async function reopenIncident(id: string) {
  return incidentRepo.reopenIncident(id);
}

export async function deleteIncident(id: string) {
  await incidentRepo.deleteIncident(id);
}
