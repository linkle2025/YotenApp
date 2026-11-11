"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BirthFields, type BirthValues, type PrefectureOption } from "@/components/birth-fields";
import { Field, FormMessage, initialFormState, SubmitButton } from "@/components/form";
import { saveProfile } from "../../actions";

export function ProfileForm({
  prefectures,
  displayName,
  birth,
  allowSkip,
  maxYear,
}: {
  prefectures: PrefectureOption[];
  displayName: string;
  birth?: BirthValues;
  allowSkip: boolean;
  maxYear: number;
}) {
  const [state, action] = useActionState(saveProfile, initialFormState);
  const v = state.values;
  const defaults: BirthValues | undefined = v ? { ...v, hourUnknown: v.hourUnknown === "on" } : birth;
  return (
    // 誤りで戻ったときに、入力した値で部品を作り直す
    <form key={JSON.stringify(v ?? {})} action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field
        label="表示名"
        name="displayName"
        autoComplete="nickname"
        required
        maxLength={50}
        defaultValue={v?.displayName ?? displayName}
        error={state.fieldErrors?.displayName}
      />
      <BirthFields prefectures={prefectures} maxYear={maxYear} defaults={defaults} errors={state.fieldErrors} />
      <SubmitButton>保存して命式をつくる</SubmitButton>
      {allowSkip && (
        <p className="text-center text-sm">
          <Link href="/home" className="text-accent underline">
            あとで入力する
          </Link>
        </p>
      )}
    </form>
  );
}
