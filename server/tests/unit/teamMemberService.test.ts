import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/utils/errors.js";

vi.mock("../../src/repos/teamMemberRepo.js", () => ({
  listActiveTeamMembersWithPinHash: vi.fn(),
  findTeamMemberById: vi.fn(),
  updateTeamMemberPin: vi.fn(),
  findActiveByFirstNamePrefix: vi.fn().mockResolvedValue([]),
  insertTeamMember: vi.fn(),
}));

import * as teamMemberRepo from "../../src/repos/teamMemberRepo.js";
import * as teamMemberService from "../../src/services/teamMemberService.js";

const listWithPinHash = vi.mocked(teamMemberRepo.listActiveTeamMembersWithPinHash);
const findById = vi.mocked(teamMemberRepo.findTeamMemberById);

async function memberRow(
  id: string,
  name: string,
  displayName: string,
  role: string,
  pin: string,
) {
  const pinHash = await teamMemberService.hashPin(pin);
  return {
    id,
    name,
    displayName,
    role,
    pin: pinHash,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("teamMemberService PIN uniqueness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findTeamMemberByPin returns the sole matching member", async () => {
    listWithPinHash.mockResolvedValue([
      await memberRow("1", "Legion Avegno", "Legion A", "OWNER", "1234"),
      await memberRow("2", "Courtney Adams", "Courtney A", "FRONT_DESK", "5678"),
    ]);

    const result = await teamMemberService.findTeamMemberByPin("1234");
    expect(result?.id).toBe("1");
    expect(result?.role).toBe("OWNER");
  });

  it("findTeamMemberByPin rejects ambiguous duplicate PINs", async () => {
    listWithPinHash.mockResolvedValue([
      await memberRow("1", "Legion Avegno", "Legion A", "OWNER", "1234"),
      await memberRow("2", "Courtney Adams", "Courtney A", "FRONT_DESK", "1234"),
    ]);

    await expect(teamMemberService.findTeamMemberByPin("1234")).rejects.toMatchObject({
      statusCode: 409,
      message: teamMemberService.AMBIGUOUS_PIN_MESSAGE,
    });
  });

  it("authenticateTeamMemberPin rejects ambiguous duplicate PINs", async () => {
    const legion = await memberRow("1", "Legion Avegno", "Legion A", "OWNER", "1234");
    listWithPinHash.mockResolvedValue([
      legion,
      await memberRow("2", "Courtney Adams", "Courtney A", "FRONT_DESK", "1234"),
    ]);
    findById.mockResolvedValue(legion);

    await expect(
      teamMemberService.authenticateTeamMemberPin("1", "1234"),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: teamMemberService.AMBIGUOUS_PIN_MESSAGE,
    });
  });

  it("changeTeamMemberPin rejects PIN already used by another member", async () => {
    listWithPinHash.mockResolvedValue([
      await memberRow("1", "Legion Avegno", "Legion A", "OWNER", "1234"),
      await memberRow("2", "Courtney Adams", "Courtney A", "FRONT_DESK", "5678"),
    ]);
    findById.mockResolvedValue(
      await memberRow("2", "Courtney Adams", "Courtney A", "FRONT_DESK", "5678"),
    );

    await expect(
      teamMemberService.changeTeamMemberPin("2", "1234"),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: teamMemberService.DUPLICATE_PIN_MESSAGE,
    });
  });

  it("changeTeamMemberPin allows keeping the same PIN for one member", async () => {
    const courtney = await memberRow(
      "2",
      "Courtney Adams",
      "Courtney A",
      "FRONT_DESK",
      "5678",
    );
    listWithPinHash.mockResolvedValue([
      await memberRow("1", "Legion Avegno", "Legion A", "OWNER", "1234"),
      courtney,
    ]);
    findById.mockResolvedValue(courtney);
    vi.mocked(teamMemberRepo.updateTeamMemberPin).mockResolvedValue(true);

    await expect(
      teamMemberService.changeTeamMemberPin("2", "5678"),
    ).resolves.toBeUndefined();
  });
});

describe("authService pinLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propagates ambiguous PIN errors from findTeamMemberByPin", async () => {
    listWithPinHash.mockResolvedValue([
      await memberRow("1", "Legion Avegno", "Legion A", "OWNER", "1234"),
      await memberRow("2", "Courtney Adams", "Courtney A", "FRONT_DESK", "1234"),
    ]);

    const { pinLogin } = await import("../../src/services/authService.js");
    await expect(pinLogin("1234")).rejects.toBeInstanceOf(AppError);
    await expect(pinLogin("1234")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("returns OWNER role for Legion PIN login", async () => {
    listWithPinHash.mockResolvedValue([
      await memberRow("1", "Legion Avegno", "Legion A", "OWNER", "9001"),
      await memberRow("2", "Hector Morales", "Hector M", "MANAGER", "7723"),
    ]);

    const { pinLogin } = await import("../../src/services/authService.js");
    const legion = await pinLogin("9001");
    expect(legion.role).toBe("OWNER");
    expect(legion.name).toBe("Legion A");

    const hector = await pinLogin("7723");
    expect(hector.role).toBe("MANAGER");
    expect(hector.name).toBe("Hector M");
  });
});
