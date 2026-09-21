import { signup as t } from "@/messages/signup";

export const personalSteps = [t.steps.verify, t.steps.terms, t.steps.form, t.steps.done];

const b = t.business.steps;
export const businessSteps = [b.terms, b.verify, b.form, b.done];
