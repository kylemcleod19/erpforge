import type { ModuleDefinition } from "../types.js";
import { bomModule } from "./bom.js";
import { customerOrdersModule } from "./customer-orders.js";
import { inventoryModule } from "./inventory.js";
import { purchasingModule } from "./purchasing.js";
import { productionModule } from "./production.js";
import { shippingModule } from "./shipping.js";
import { financeModule } from "./finance.js";
import { qualityModule } from "./quality.js";
import { reportingModule } from "./reporting.js";
import { equipmentModule } from "./equipment.js";

export const ALL_MODULES: ModuleDefinition[] = [
  bomModule,
  customerOrdersModule,
  inventoryModule,
  purchasingModule,
  productionModule,
  shippingModule,
  financeModule,
  qualityModule,
  reportingModule,
  equipmentModule,
];

export const MODULE_MAP: Record<string, ModuleDefinition> = Object.fromEntries(
  ALL_MODULES.map((m) => [m.id, m])
);

export function getModule(id: string): ModuleDefinition {
  const m = MODULE_MAP[id];
  if (!m) throw new Error(`Unknown module id: ${id}`);
  return m;
}

export {
  bomModule,
  customerOrdersModule,
  inventoryModule,
  purchasingModule,
  productionModule,
  shippingModule,
  financeModule,
  qualityModule,
  reportingModule,
  equipmentModule,
};
