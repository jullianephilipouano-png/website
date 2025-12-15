import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
  Alert,
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../lib/api';
import { getToken, removeToken } from '../../lib/auth';
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";


export default function ProfileScreen({ navigation, route }: any) {
  const [user, setUser] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const fadeAnim = useState(new Animated.Value(0))[0];
const router = useRouter();
  const fetchUserProfile = async () => {
    const tokenObj = await getToken();
    const bearer = tokenObj?.token || tokenObj?.user?.token;
    
    if (bearer) {
      try {
        const res = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${bearer}` }
        });
        setUser(res.data);
        
        // Fade in animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();
      } catch (err) {
        console.error("Profile fetch failed", err);
        Alert.alert("Error", "Failed to load profile data");
      }
    }
  };

  const fetchSubmissions = async () => {
    const tokenObj = await getToken();
    const bearer = tokenObj?.token || tokenObj?.user?.token;
    
    if (bearer) {
      try {
        const res = await api.get('/student/my-research', {
          headers: { Authorization: `Bearer ${bearer}` }
        });
        setSubmissions(res.data || []);
      } catch (err) {
        console.error("Submissions fetch failed", err);
      }
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchUserProfile(), fetchSubmissions()]);
      setLoading(false);
    })();
  }, []);

 useEffect(() => {
  (async () => {
    setLoading(true);
    await Promise.all([fetchUserProfile(), fetchSubmissions()]);
    setLoading(false);
  })();
}, []);

// 🚀 refresh every time user returns from EditProfile
useFocusEffect(
  React.useCallback(() => {
    fetchUserProfile();
  }, [])
);

  

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUserProfile(), fetchSubmissions()]);
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await removeToken();
            // Simple reload to clear state instead of navigation
            if (Platform.OS === 'web') {
              window.location.href = '/login';
            }
          },
        },
      ]
    );
  };

 const handleEditProfile = () => {
 router.push({
  pathname: "/EditProfile",
  params: { user: JSON.stringify(user) }
});


};


  const handleChangePassword = () => {
    Alert.alert("Change Password", "This feature will be available soon");
  };

  const handleViewSubmission = (submission: any) => {
    Alert.alert(
      submission.title,
      `Status: ${submission.status}\nType: ${submission.submissionType}\n\nAbstract: ${submission.abstract}`,
      [
        { text: "Close", style: "cancel" },
        { 
          text: "View Details", 
          onPress: () => {
            // You can add more detailed view here
            console.log('View submission:', submission);
          }
        }
      ]
    );
  };

  const handleNewSubmission = () => {
    Alert.alert("New Submission", "Navigate to submission form");
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  // Calculate stats from submissions
  const stats = {
    total: submissions.length,
    approved: submissions.filter(s => s.status === 'approved').length,
    pending: submissions.filter(s => s.status === 'pending').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  };

  const InfoCard = ({ icon, label, value }: any) => (
    <View style={styles.infoCard}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={22} color="#2563eb" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'Not provided'}</Text>
      </View>
    </View>
  );

  const ActionButton = ({ icon, label, onPress, color = "#2563eb" }: any) => (
    <TouchableOpacity 
      style={[styles.actionButton, { borderColor: color }]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.actionButtonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'rejected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return 'checkmark-circle';
      case 'pending': return 'time';
      case 'rejected': return 'close-circle';
      default: return 'document';
    }
  };

  const SubmissionCard = ({ item }: any) => (
    <TouchableOpacity 
      style={styles.submissionCard}
      onPress={() => handleViewSubmission(item)}
      activeOpacity={0.7}
    >
      <View style={styles.submissionHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Ionicons 
            name={getStatusIcon(item.status)} 
            size={14} 
            color={getStatusColor(item.status)} 
          />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.submissionType}>
          {item.submissionType === 'final' ? '📄 Final' : '📝 Draft'}
        </Text>
      </View>
      
      <Text style={styles.submissionTitle} numberOfLines={2}>
        {item.title}
      </Text>
      
      <Text style={styles.submissionAbstract} numberOfLines={2}>
        {item.abstract}
      </Text>
      
      <View style={styles.submissionFooter}>
        <View style={styles.submissionMeta}>
          <Ionicons name="calendar-outline" size={12} color="#64748b" />
          <Text style={styles.metaText}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
        {item.adviser && (
          <View style={styles.submissionMeta}>
            <Ionicons name="person-outline" size={12} color="#64748b" />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.adviser}
            </Text>
          </View>
        )}
      </View>

      {item.facultyComment && (
        <View style={styles.commentBox}>
          <Ionicons name="chatbox-outline" size={14} color="#6b7280" />
          <Text style={styles.commentText} numberOfLines={2}>
            {item.facultyComment}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2563eb"]} />
      }
    >
      {/* Header with gradient */}
      <LinearGradient
        colors={['#3b82f6', '#2563eb', '#1e40af']}
        style={styles.headerGradient}
      >
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarBorder}>
            <Ionicons name="person" size={64} color="#fff" />
          </View>
          <TouchableOpacity style={styles.cameraButton} activeOpacity={0.8}>
            <Ionicons name="camera" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.name}>{user?.fullName || "User"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem} activeOpacity={0.7}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem} activeOpacity={0.7}>
              <Text style={styles.statValue}>{stats.approved}</Text>
              <Text style={styles.statLabel}>Approved</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem} activeOpacity={0.7}>
              <Text style={styles.statValue}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.statItem} activeOpacity={0.7}>
              <Text style={styles.statValue}>{stats.rejected}</Text>
              <Text style={styles.statLabel}>Rejected</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </LinearGradient>

      <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
       
        {/* Profile Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          
          <InfoCard 
            icon="mail-outline" 
            label="Email" 
            value={user?.email} 
          />
          <InfoCard 
            icon="call-outline" 
            label="Phone" 
            value={user?.phone} 
          />
          <InfoCard 
            icon="school-outline" 
            label="Affiliation" 
            value={user?.affiliation} 
          />
          <InfoCard 
            icon="briefcase-outline" 
            label="Role" 
            value={user?.role} 
          />
          <InfoCard 
            icon="business-outline" 
            label="College" 
            value={user?.college} 
          />
          <InfoCard 
            icon="calendar-outline" 
            label="Member Since" 
            value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }) : '--'}
          />
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          
          <ActionButton 
            icon="create-outline" 
            label="Edit Profile" 
            onPress={handleEditProfile}
          />
          <ActionButton 
  icon="key-outline" 
  label="Change Password" 
  onPress={() => router.push("/ChangePassword")}
/>
      
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={22} color="#dc2626" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Version 1.0.0</Text>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f1f5f9',
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f1f5f9' 
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'web' ? 60 : 50,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarWrapper: {
    alignSelf: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  avatarBorder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2563eb',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  name: { 
    textAlign: 'center', 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#fff', 
    marginBottom: 4,
  },
  email: { 
    textAlign: 'center', 
    fontSize: 14, 
    color: 'rgba(255, 255, 255, 0.9)', 
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 8,
  },
  contentContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingLeft: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  submissionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  submissionType: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  submissionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  submissionAbstract: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 12,
  },
  submissionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  submissionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  metaText: {
    fontSize: 11,
    color: '#64748b',
  },
  commentBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  commentText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 16,
    marginBottom: 20,
  },
  emptyStateButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  viewAllText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 14,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
    justifyContent: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    gap: 8,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
  },
  versionText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 20,
  },
});