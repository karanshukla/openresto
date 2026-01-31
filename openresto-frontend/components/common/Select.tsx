import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  Modal,
  Pressable,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useState } from "react";

export interface SelectOption {
  label: string;
  value: any;
}

export default function Select({
  options,
  onSelect,
  selectedValue,
  placeholder = "Select an option",
}: {
  options: SelectOption[];
  onSelect: (value: any) => void;
  selectedValue?: any;
  placeholder?: string;
}) {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find((o) => o.value === selectedValue);

  return (
    <>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <ThemedView style={styles.centeredView}>
          <ThemedView style={styles.modalView}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onSelect(item.value);
                    setModalVisible(false);
                  }}
                >
                  <ThemedText>{item.label}</ThemedText>
                </TouchableOpacity>
              )}
            />
          </ThemedView>
        </ThemedView>
      </Modal>
      <Pressable
        style={styles.button}
        onPress={() => setModalVisible(true)}
      >
        <ThemedText>{selectedOption?.label ?? placeholder}</ThemedText>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: "gray",
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  option: {
    padding: 10,
  },
});
