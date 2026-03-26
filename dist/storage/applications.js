"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApplicationId = generateApplicationId;
exports.applicationFolderName = applicationFolderName;
exports.createApplicationFolder = createApplicationFolder;
exports.deleteApplicationFolder = deleteApplicationFolder;
exports.buildRecord = buildRecord;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
function sanitizeForPath(input) {
    // Remove characters invalid for Windows filenames and trim whitespace.
    return input
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .trim();
}
function extractNick(nickLevelAge) {
    const cleaned = nickLevelAge.trim();
    if (!cleaned)
        return "unknown";
    // Typical format: "Nick, level, age" -> take first segment.
    const first = cleaned.split(/[,\n\r]/)[0]?.trim();
    return first && first.length > 0 ? first : "unknown";
}
function generateApplicationId() {
    return crypto_1.default.randomUUID();
}
function applicationFolderName(nickLevelAge, applicationId) {
    const nick = extractNick(nickLevelAge);
    const nickSafe = sanitizeForPath(nick).slice(0, 40);
    return `Заявка-${nickSafe}-${applicationId}`;
}
async function createApplicationFolder(params) {
    const folderName = applicationFolderName(params.nickLevelAge, params.applicationId);
    const basePath = path_1.default.resolve(process.cwd(), config_1.config.APPLICATIONS_BASE_PATH);
    const folderPath = path_1.default.join(basePath, folderName);
    await fs_1.promises.mkdir(folderPath, { recursive: false });
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
    await fs_1.promises.writeFile(path_1.default.join(folderPath, "form.md"), md, "utf8");
    return { folderName, nickFromForm };
}
async function deleteApplicationFolder(folderName) {
    const basePath = path_1.default.resolve(process.cwd(), config_1.config.APPLICATIONS_BASE_PATH);
    const folderPath = path_1.default.join(basePath, folderName);
    await fs_1.promises.rm(folderPath, { recursive: true, force: true });
}
function buildRecord(input) {
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
