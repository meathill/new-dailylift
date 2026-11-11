import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { DownloadIcon, EraserIcon, FloppyDiskIcon, ShareIcon } from 'phosphor-react-native';

interface SchemeBarProps {
  schemeName: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onShare: () => void;
  onImport: () => void;
  onClear: () => void;
}

/** 方案操作栏：名称、保存、分享、导入、清空 */
export function SchemeBar({
  schemeName,
  onNameChange,
  onSave,
  onShare,
  onImport,
  onClear,
}: SchemeBarProps) {
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.nameInput}
        value={schemeName}
        onChangeText={onNameChange}
        placeholder="方案名称"
        placeholderTextColor="#5A6B85"
        maxLength={20}
      />
      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={onSave}>
          <FloppyDiskIcon size={20} color="#E8D5B5" />
        </Pressable>
        <Pressable style={styles.button} onPress={onShare}>
          <ShareIcon size={20} color="#E8D5B5" />
        </Pressable>
        <Pressable style={styles.button} onPress={onImport}>
          <DownloadIcon size={20} color="#E8D5B5" />
        </Pressable>
        <Pressable style={styles.button} onPress={onClear}>
          <EraserIcon size={20} color="#C9D4E8" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  nameInput: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(42, 56, 80, 0.4)',
    color: '#C9D4E8',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42, 56, 80, 0.6)',
  },
});
