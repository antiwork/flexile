import { Text, View } from "@react-pdf/renderer";
import React from "react";
import { formatMoneyFromCents } from "@/utils/formatMoney";

interface SummaryProps {
  amount: bigint;
  tax?: bigint;
  vat?: bigint;
  currency: string;
  totalLabel: string;
  taxLabel: string;
  vatLabel: string;
}

export function Summary({ amount, tax, vat, totalLabel, taxLabel, vatLabel }: SummaryProps) {
  return (
    <View
      style={{
        marginTop: 60,
        marginBottom: 40,
        alignItems: "flex-end",
        marginLeft: "auto",
        width: 250,
      }}
    >
      {tax ? (
        <View style={{ flexDirection: "row", marginBottom: 5, width: "100%" }}>
          <Text style={{ fontSize: 9, flex: 1 }}>{taxLabel}</Text>
          <Text style={{ fontSize: 9, textAlign: "right" }}>{formatMoneyFromCents(tax)}</Text>
        </View>
      ) : null}

      {vat ? (
        <View style={{ flexDirection: "row", marginBottom: 5, width: "100%" }}>
          <Text style={{ fontSize: 9, flex: 1 }}>{vatLabel}</Text>
          <Text style={{ fontSize: 9, textAlign: "right" }}>{formatMoneyFromCents(vat)}</Text>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          marginTop: 5,
          borderTopWidth: 0.5,
          borderTopColor: "#000",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 5,
          width: "100%",
        }}
      >
        <Text style={{ fontSize: 9, marginRight: 10 }}>{totalLabel}</Text>
        <Text style={{ fontSize: 21 }}>{formatMoneyFromCents(amount)}</Text>
      </View>
    </View>
  );
}
