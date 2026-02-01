import { RestaurantDto } from "@/api/restaurants";
import { useState } from "react";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";
import { ThemedText } from "../themed-text";

export interface BookingFormData {
  customerEmail: string;
  seats: number;
  tableId: number;
}

export default function BookingForm({
  restaurant,
  onSubmit,
}: {
  restaurant: RestaurantDto;
  onSubmit: (data: BookingFormData) => void;
}) {
  const [customerEmail, setCustomerEmail] = useState("");
  const [seats, setSeats] = useState(1);
  const allTables = restaurant.sections.flatMap((s) => s.tables);
  const [tableId, setTableId] = useState<number | undefined>(
    allTables[0]?.id
  );

  const handleSubmit = () => {
    if (tableId) {
      onSubmit({
        customerEmail,
        seats,
        tableId,
      });
    }
  };

  const seatOptions = [...Array(10).keys()].map((i) => ({
    label: `${i + 1}`,
    value: i + 1,
  }));
  const tableOptions = allTables.map((table) => ({
    label: `${table.name} (Seats: ${table.seats})`,
    value: table.id,
  }));

  return (
    <>
      <ThemedText>Email</ThemedText>
      <Input
        placeholder="your@email.com"
        value={customerEmail}
        onChangeText={setCustomerEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <ThemedText>Number of Seats</ThemedText>
      <Select
        selectedValue={seats}
        onSelect={setSeats}
        options={seatOptions}
      />

      <ThemedText>Table</ThemedText>
      <Select
        selectedValue={tableId}
        onSelect={setTableId}
        options={tableOptions}
        placeholder="Select a table"
      />

      <Button onPress={handleSubmit} disabled={!tableId}>
        Submit
      </Button>
    </>
  );
}
