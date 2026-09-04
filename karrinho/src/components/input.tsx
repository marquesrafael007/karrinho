import {TextInput, StyleSheet, type TextInputProps} from "react-native";

export function Input({...rest}:TextInputProps){
    return <TextInput style={styles.input} {...rest} />
}

const styles = StyleSheet.create({
    input: {
        width: '100%',
        height: 48,
        backgroundColor: '#f1f1f1',
        borderWidth:1,
        borderColor: 'gray',
        borderRadius: 16,
        padding: 16,
    }
})
