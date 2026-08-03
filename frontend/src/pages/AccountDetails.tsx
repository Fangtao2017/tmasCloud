import React, { useEffect, useState } from 'react';
import { Avatar, Button, Card, Form, Input, message, Tag, Typography } from 'antd';
import { CalendarOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || '';

type Role = 'admin' | 'site_admin' | 'operator' | 'viewer';

interface ProfileData {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  status: string;
  lastLogin: string | null;
  siteIds: number[] | null;
}

interface Site {
  id: number;
  name: string;
}

const roleColorMap: Record<Role, string> = {
  admin: 'volcano',
  site_admin: 'purple',
  operator: 'blue',
  viewer: 'green',
};

const roleLabelMap: Record<Role, string> = {
  admin: 'Admin',
  site_admin: 'Site Admin',
  operator: 'Operator',
  viewer: 'Viewer',
};

function fmtDate(d: string | null): string {
  if (!d) return 'Never';
  return new Date(d).toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const AccountDetails: React.FC = () => {
  const [form] = Form.useForm();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, sitesRes] = await Promise.all([
          fetch(`${API}/api/users/me`, { credentials: 'include' }),
          fetch(`${API}/api/sites`, { credentials: 'include' }),
        ]);
        if (profileRes.ok) {
          const { user } = await profileRes.json();
          setProfile(user);
          form.setFieldsValue({ displayName: user.displayName });
        }
        if (sitesRes.ok) {
          const data = await sitesRes.json();
          setSites(Array.isArray(data) ? data : (data.sites ?? []));
        }
      } catch {
        message.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [form]);

  const handleSave = async () => {
    try {
      const { displayName } = await form.validateFields();
      setSaving(true);
      const res = await fetch(`${API}/api/users/me`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message);
      setProfile((p) => (p ? { ...p, displayName } : p));
      message.success('Profile updated');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const assignedSites =
    profile?.siteIds === null
      ? null // admin — all sites
      : sites.filter((s) => profile?.siteIds?.includes(s.id));

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Text type="secondary">Loading…</Text>
      </div>
    );
  }
  if (!profile) return null;

  const initial = (profile.displayName || profile.username).charAt(0).toUpperCase();

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {/* Avatar + name header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
            <Avatar
              size={72}
              style={{
                background: 'linear-gradient(135deg, #0f5c9b 0%, #1a8cff 100%)',
                fontSize: 28,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initial}
            </Avatar>
            <div>
              <Title level={4} style={{ margin: 0 }}>{profile.displayName}</Title>
              <Text type="secondary">@{profile.username}</Text>
              <div style={{ marginTop: 6 }}>
                <Tag color={roleColorMap[profile.role]}>{roleLabelMap[profile.role]}</Tag>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Username</Text>
              <div><Text strong>{profile.username}</Text></div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Account Status</Text>
              <div>
                <Tag color={profile.status === 'active' ? 'green' : 'default'} style={{ margin: 0 }}>
                  {profile.status}
                </Tag>
              </div>
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 16px', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <CalendarOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>Last Login</Text>
              </div>
              <Text>{fmtDate(profile.lastLogin)}</Text>
            </div>
          </div>

          {/* Assigned Sites */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <SafetyCertificateOutlined style={{ color: '#8c8c8c', fontSize: 13 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>Assigned Sites</Text>
            </div>
            {assignedSites === null ? (
              <Tag color="gold">All Sites</Tag>
            ) : assignedSites.length === 0 ? (
              <Text type="secondary">No sites assigned</Text>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {assignedSites.map((s) => <Tag key={s.id}>{s.name}</Tag>)}
              </div>
            )}
          </div>

          {/* Edit display name */}
          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 20 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>Edit Profile</Text>
            <Form form={form} layout="vertical">
              <Form.Item
                name="displayName"
                label="Display Name"
                rules={[
                  { required: true, message: 'Please enter a display name' },
                  { min: 2, message: 'At least 2 characters' },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Your full name"
                  style={{ maxWidth: 320 }}
                />
              </Form.Item>
              <Button type="primary" loading={saving} onClick={handleSave}>
                Save Changes
              </Button>
            </Form>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AccountDetails;
