import { createElement } from "react";
import { departmentIcon } from "../visuals";

export function DepartmentIcon({ name, className }: { name: string; className?: string }) {
  return createElement(departmentIcon(name), { "aria-hidden": true, className });
}
