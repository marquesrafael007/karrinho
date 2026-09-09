import{ TouchableOpacity, StyleSheet, Text, type TouchableOpacityProps } from "react-native";

type ButtonProps = TouchableOpacityProps & {
    label: string
}

export function Button({ label, ...rest }: ButtonProps) {
    return (
        <TouchableOpacity style={styles.container} activeOpacity={0.7} {...rest}>
            <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
    )
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#ffffffff',
        borderWidth: 1,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8,
    },
    label:{
        color: '#000000ff',
        fontWeight: 'bold',
        fontSize: 14,
    }
})