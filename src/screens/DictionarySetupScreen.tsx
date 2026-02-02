/**
 * 辞書セットアップ画面
 *
 * 初回起動時や辞書データが存在しない場合に表示され、
 * ユーザーに辞書データのダウンロードを促します。
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Book, Download, CheckCircle, AlertCircle, Wifi } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useNetInfo } from '@react-native-community/netinfo';

import { Colors } from '../constants/colors';
import { Button } from '../components/common/Button';
import { useTheme } from '../hooks/useTheme';
import {
  installDictionary,
  fetchRemoteMetadata,
  DownloadProgress,
  InstallStatus,
  DictionaryMetadata,
} from '../services/dictionary/ExternalDictionaryService';

interface DictionarySetupScreenProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

/**
 * 辞書セットアップ画面コンポーネント
 */
export function DictionarySetupScreen({
  onComplete,
  onSkip,
}: DictionarySetupScreenProps): React.JSX.Element {
  const navigation = useNavigation();
  const { t } = useTranslation(['dictionary', 'common']);
  const netInfo = useNetInfo();
  const { colors } = useTheme();

  const [status, setStatus] = useState<InstallStatus>('not_installed');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<DictionaryMetadata | null>(null);

  // メタデータを取得
  useEffect(() => {
    async function loadMetadata() {
      const result = await fetchRemoteMetadata();
      if (result.success) {
        setMetadata(result.data);
      }
    }
    loadMetadata();
  }, []);

  // 完了時の処理
  const handleComplete = useCallback(() => {
    if (onComplete) {
      onComplete();
    } else {
      navigation.goBack();
    }
  }, [onComplete, navigation]);

  // スキップ時の処理
  const handleSkip = useCallback(() => {
    if (onSkip) {
      onSkip();
    } else {
      navigation.goBack();
    }
  }, [onSkip, navigation]);

  // ダウンロード開始
  const handleDownload = useCallback(async () => {
    setError(null);
    setProgress(null);

    const result = await installDictionary(
      (prog) => setProgress(prog),
      (stat) => setStatus(stat)
    );

    if (result.success) {
      // インストール完了後に少し待ってからコールバック
      setTimeout(() => {
        handleComplete();
      }, 1000);
    } else {
      setError(result.error.message);
    }
  }, [handleComplete]);

  // ステータスに応じたアイコンを取得
  const getStatusIcon = () => {
    switch (status) {
      case 'installed':
        return <CheckCircle size={64} color={colors.success} />;
      case 'error':
        return <AlertCircle size={64} color={colors.error} />;
      case 'downloading':
      case 'extracting':
      case 'installing':
        return <ActivityIndicator size={64} color={colors.primary} />;
      default:
        return <Book size={64} color={colors.primary} />;
    }
  };

  // ステータスに応じたメッセージを取得
  const getStatusMessage = () => {
    switch (status) {
      case 'checking':
        return t('dictionary:status.checking');
      case 'downloading':
        return progress
          ? t('dictionary:status.downloading', { percentage: progress.percentage })
          : t('dictionary:status.downloadingStart');
      case 'extracting':
        return t('dictionary:status.extracting');
      case 'installing':
        return t('dictionary:status.installing');
      case 'installed':
        return t('dictionary:status.installed');
      case 'error':
        return t('dictionary:status.error');
      default:
        return t('dictionary:status.notInstalled');
    }
  };

  // ファイルサイズをフォーマット
  const formatFileSize = (bytes: number): string => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const isOffline = netInfo.isConnected === false;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* アイコン */}
        <View style={styles.iconContainer}>{getStatusIcon()}</View>

        {/* タイトル */}
        <Text style={[styles.title, { color: colors.text }]}>{t('dictionary:setup.title')}</Text>

        {/* 説明 */}
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {t('dictionary:setup.description')}
        </Text>

        {/* メタデータ情報 */}
        {metadata && status === 'not_installed' && (
          <View style={[styles.metadataContainer, { backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.metadataText, { color: colors.textSecondary }]}>
              {t('dictionary:setup.version')}: {metadata.version}
            </Text>
            <Text style={[styles.metadataText, { color: colors.textSecondary }]}>
              {t('dictionary:setup.downloadSize')}: {formatFileSize(metadata.compressedSize)}
            </Text>
            <Text style={[styles.metadataText, { color: colors.textSecondary }]}>
              {t('dictionary:setup.installedSize')}: {formatFileSize(metadata.uncompressedSize)}
            </Text>
          </View>
        )}

        {/* ステータスメッセージ */}
        <Text style={[styles.statusText, { color: colors.text }]}>{getStatusMessage()}</Text>

        {/* 進捗バー */}
        {progress && status === 'downloading' && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[styles.progressFill, { width: `${progress.percentage}%`, backgroundColor: colors.primary }]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {formatFileSize(progress.downloadedBytes)} / {formatFileSize(progress.totalBytes)}
            </Text>
          </View>
        )}

        {/* エラーメッセージ */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.errorLight }]}>
            <AlertCircle size={20} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {/* オフライン警告 */}
        {isOffline && status === 'not_installed' && (
          <View style={[styles.warningContainer, { backgroundColor: colors.warningLight }]}>
            <Wifi size={20} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.warning }]}>
              {t('dictionary:setup.offlineWarning')}
            </Text>
          </View>
        )}

        {/* Wi-Fi推奨メッセージ */}
        {!isOffline && metadata && status === 'not_installed' && metadata.compressedSize > 10 * 1024 * 1024 && (
          <View style={styles.infoContainer}>
            <Wifi size={16} color={colors.textSecondary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              {t('dictionary:setup.wifiRecommended')}
            </Text>
          </View>
        )}

        {/* ボタン */}
        <View style={styles.buttonContainer}>
          {status === 'not_installed' && (
            <>
              <Button
                title={t('dictionary:setup.downloadButton')}
                onPress={handleDownload}
                disabled={isOffline}
                leftIcon={<Download size={20} color="#FFFFFF" />}
                style={styles.downloadButton}
              />
              <Button
                title={t('dictionary:setup.skipButton')}
                onPress={handleSkip}
                variant="ghost"
                style={styles.skipButton}
              />
            </>
          )}

          {status === 'error' && (
            <Button
              title={t('dictionary:setup.retryButton')}
              onPress={handleDownload}
              disabled={isOffline}
            />
          )}

          {status === 'installed' && (
            <Button
              title={t('dictionary:setup.continueButton')}
              onPress={handleComplete}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  metadataContainer: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  metadataText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: '100%',
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    marginLeft: 8,
    flex: 1,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    width: '100%',
  },
  warningText: {
    fontSize: 14,
    color: Colors.warning,
    marginLeft: 8,
    flex: 1,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  infoText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 16,
  },
  downloadButton: {
    marginBottom: 12,
  },
  skipButton: {
    marginTop: 8,
  },
});

export default DictionarySetupScreen;
