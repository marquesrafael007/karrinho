import { Text, View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Input } from "@/components/input";
import { Button } from "@/components/button";

export default function Home() {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, }}
      behavior={Platform.select({ios: 'padding', android: 'height'})}>
      <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Karrinho</Text>
          </View>
          <View style={styles.formContainer}>
            <Text>Insira o link do produto:</Text>
            <Input keyboardType="url"/>
            <Button label="Adicionar" />
          </View>
          <View style={styles.footer}>
            <Text style={styles.title}>footer</Text>
          </View>
      </ScrollView>
    </KeyboardAvoidingView>
    
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 32,
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  header: {
    height: 48,
    backgroundColor: 'blue',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  footer:{
    height: 48,
    backgroundColor: 'blue',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer:{
    gap: 12,
  }
});