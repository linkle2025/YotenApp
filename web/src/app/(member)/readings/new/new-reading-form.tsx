"use client";

import { useActionState } from "react";
import { BirthFields, type BirthValues, type PrefectureOption } from "@/components/birth-fields";
import { Field, FormMessage, initialFormState, SubmitButton } from "@/components/form";
import { createReading } from "../actions";

export function NewReadingForm({ prefectures, maxYear }: { prefectures: PrefectureOption[]; maxYear: number }) {
  const [state, action] = useActionState(createReading, initialFormState);
  const v = state.values;
  const defaults: BirthValues | undefined = v ? { ...v, hourUnknown: v.hourUnknown === "on" } : undefined;
  return (
    <form key={JSON.stringify(v ?? {})} action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field
        label="氏名（任意）"
        name="name"
        autoComplete="off"
        maxLength={100}
        defaultValue={v?.name}
        hint="記録の一覧で見分けるために使います。空のままでも作れます。"
        error={state.fieldErrors?.name}
      />
      <BirthFields prefectures={prefectures} defaults={defaults} errors={state.fieldErrors} maxYear={maxYear} />
      <SubmitButton pendingLabel="計算しています…">命式をつくる</SubmitButton>
    </form>
  );
}
