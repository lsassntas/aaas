import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { config } from "../config";
import type { ApplicationForm, ApplicationRecord } from "../types";

function sanitizeForPath(input: string): string {
  // Remove characters invalid for Windows filenames and trim whitespace.
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .trim();
}

function extractNick(nickLevelAge: string): string {
  const cleaned = nickLevelAge.trim();
  if (!cleaned) return "unknown";
  // Typical format: "Nick, level, age" -> take first segment.
  const first = cleaned.split(/[,\n\r]/)[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

export function generateApplicationId(): string {
  return crypto.randomUUID();
}

export function applicationFolderName(nickLevelAge: string, applicationId: string): string {
  const nick = extractNick(nickLevelAge);
  const nickSafe = sanitizeForPath(nick).slice(0, 40);
  return `Заявка-${nickSafe}-${applicationId}`;
}

export async function createApplicationFolder(params: {
  applicationId: string;
  nickLevelAge: string;
  form: ApplicationForm;
}): Promise<{ folderName: string; nickFromForm: string }> {
  const folderName = applicationFolderName(params.nickLevelAge, params.applicationId);
  const basePath = path.resolve(process.cwd(), config.APPLICATIONS_BASE_PATH);
  const folderPath = path.join(basePath, folderName);

  await fs.mkdir(folderPath, { recursive: false });

  const nickFromForm = extractNick(params.nickLevelAge);

  const md = [
    `# Заявка в семью`,
    ``,
    `## Данные из формы`,
    `Никнейм/уровень/возраст ИРЛ: ${params.nickLevelAge}`,
    `Сколько играете на проекте: ${params.form.projectPlayTime}`,
    `Были ли в семьях (и какие): ${params.form.previousFamilies}`,
    `Результаты по урону на ДМ 10 минут: ${params.form.damageDm10}`,
    ``,
    `## Тех. информация`,
    `ApplicationId: ${params.applicationId}`,
  ].join("\n");

  await fs.writeFile(path.join(folderPath, "form.md"), md, "utf8");

  return { folderName, nickFromForm };
}

export async function deleteApplicationFolder(folderName: string): Promise<void> {
  const basePath = path.resolve(process.cwd(), config.APPLICATIONS_BASE_PATH);
  const folderPath = path.join(basePath, folderName);
  await fs.rm(folderPath, { recursive: true, force: true });
}

export function buildRecord(input: {
  applicationId: string;
  folderName: string;
  discordChannelId: string;
  reviewMessageId: string;
  discordUserId: string;
  nickFromForm: string;
  form: ApplicationForm;
  status: ApplicationRecord["status"];
}): ApplicationRecord {
  return {
    applicationId: input.applicationId,
    folderName: input.folderName,
    discordChannelId: input.discordChannelId,
    reviewMessageId: input.reviewMessageId,
    discordUserId: input.discordUserId,
    nickFromForm: input.nickFromForm,
    form: input.form,
    createdAtIso: new Date().toISOString(),
    status: input.status,
  };
}

