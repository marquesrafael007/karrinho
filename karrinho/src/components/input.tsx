import {TextInput, StyleSheet, type TextInputProps} from "react-native";

export function InputURL({...rest}:TextInputProps) {
    return <TextInput style={styles.input} {...rest} />
}

const styles = StyleSheet.create({
    input: {
        width: '100%',
        height: 36,
        backgroundColor: '#5f5f5fff',
        borderWidth:1,
        borderColor: 'gray',
        borderRadius: 16,
        padding: 8,
        color: '#ffffff6f',
        fontSize: 12,
    }
})
