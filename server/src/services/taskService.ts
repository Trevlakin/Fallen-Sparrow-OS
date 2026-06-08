import * as taskRepo from "../repos/taskRepo.js";

export async function listTasks(status?: taskRepo.TaskStatus | "all") {
  return taskRepo.listTasks({ status: status ?? "all" });
}

export async function completeTask(id: string) {
  return taskRepo.completeTask(id);
}

export async function reopenTask(id: string) {
  return taskRepo.reopenTask(id);
}

export async function deleteTask(id: string) {
  await taskRepo.deleteTask(id);
}
