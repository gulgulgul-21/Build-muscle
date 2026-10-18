import { describe, it, expect } from "vitest";
import { translate } from "./LanguageProvider";
import { settingsSchema } from "../domain/model";
import { seedData } from "../db/seed";
describe("localization", () => {
  it("uses Thai by default for older backups", () => {
    const { language, ...old } = seedData().settings[0];
    expect(language).toBe("th");
    expect(settingsSchema.parse(old).language).toBe("th");
  });
  it("translates interpolated labels while preserving Thai and user text", () => {
    expect(translate("en", "เริ่มฝึก {0}", "A")).toBe("Start workout A");
    expect(translate("th", "เริ่มฝึก {0}", "A")).toBe("เริ่มฝึก A");
    expect(translate("en", "my own workout note")).toBe("my own workout note");
    expect(translate("en", " ครั้ง ")).toBe(" reps ");
    expect(translate("en", "วัน{0}", translate("en", "จันทร์"))).toBe("Monday");
  });
});
