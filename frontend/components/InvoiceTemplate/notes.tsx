import { Text, View } from "@react-pdf/renderer";
import React from "react";

type Props = {
  content?: string | null | undefined;
  noteLabel?: string;
};

export function Note({ content, noteLabel }: Props) {
  if (!content) return null;
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 5 }}>{noteLabel}</Text>
      <Text style={{ fontSize: 10 }}>{content}</Text>
    </View>
  );
}
