import type { ProductConfig } from "@/hooks/use-app-store";

export function getUnitLabel(config: ProductConfig, unitId: string, lang: "ar" | "en"): string {
  const unit = config.units.find(u => u.id === unitId);
  if (!unit) return unitId;
  return lang === "ar" ? unit.labelAr : unit.labelEn;
}

export function getBaseUnit(config: ProductConfig): string {
  return config.units.find(u => u.isBase)?.id || config.defaultUnit || config.units[0]?.id || "ton";
}

export function getBaseUnitLabel(config: ProductConfig, lang: "ar" | "en"): string {
  return getUnitLabel(config, getBaseUnit(config), lang);
}

export function convertToBase(config: ProductConfig, quantity: number, unitId: string): number {
  const unit = config.units.find(u => u.id === unitId);
  if (!unit || unit.isBase) return quantity;
  if (unit.conversionToBase) return quantity / unit.conversionToBase;
  return quantity;
}

export function getDefaultUnit(config: ProductConfig): string {
  return config.defaultUnit || getBaseUnit(config);
}

export type { ProductConfig };