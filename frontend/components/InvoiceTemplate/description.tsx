import { Text } from "@react-pdf/renderer";
import React from "react";

type Props = {
  content?: string | null | undefined;
};

export function Description({ content }: Props) {
  if (!content) return null;
  return <Text style={{ fontSize: 9 }}>{content}</Text>;
}
