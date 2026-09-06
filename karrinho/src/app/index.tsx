import { Text, View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { InputURL } from "@/components/input";
import { Button } from "@/components/button";
import { useState } from "react";

export default function Home() {

  const[url, setURL] = useState('')

  function verifyURL(url:string){
    if(!url.trim()){
      return Alert.alert("Url inválida", "Preencha o campo com uma url válida")
    }

  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, }}
      behavior={Platform.select({ios: 'padding', android: 'height'})}>
      <ScrollView 
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps='handled'
      >
          <View style={styles.header}>
            <Text style={styles.title}>Karrinho</Text>
          </View>
          <View style={styles.formContainer}>
            <Text>Insira o link do produto:</Text>
            <InputURL value={url} onChangeText={setURL} keyboardType="url" placeholder="Digite a url"/>
            <Button label="Adicionar" onPress={() => verifyURL(url)}/>
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