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
        height: 'auto',
        backgroundColor: '#020202',
        borderWidth: 1,
        borderColor: 'gray',
        borderRadius: 16,
        padding: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    label:{
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    }
})