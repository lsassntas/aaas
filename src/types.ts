export type ApplicationForm = {
  nickLevelAge: string; // "Ник, уровень, возраст ИРЛ" (в одном поле)
  projectPlayTime: string; // "Сколько играете на проекте"
  previousFamilies: string; // "Были ли в семьях..."
  damageDm10: string; // "Ваши результаты по урону на ДМ 10 минут?"
};

export type ApplicationRecord = {
  applicationId: string;
  folderName: string;
  discordChannelId: string;
  reviewMessageId: string;
  discordUserId: string;
  nickFromForm: string;
  form: ApplicationForm;
  createdAtIso: string;
  status: "submitted" | "in_review" | "in_reviewing" | "accepted" | "rejected";
};

