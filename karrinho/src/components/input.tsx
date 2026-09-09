import {TextInput, StyleSheet, type TextInputProps} from "react-native";

export function InputURL({...rest}:TextInputProps) {
    return <TextInput style={styles.input} {...rest} />
}

const styles = StyleSheet.create({
    input: {
        width: '100%',
        height: 36,
        backgroundColor: '#1f1e20ff',
        borderWidth:1,
        borderColor: '#5e5e5eff',
        borderRadius: 16,
        padding: 8,
        color: '#ffffff96',
        fontSize: 12,
    }
})
