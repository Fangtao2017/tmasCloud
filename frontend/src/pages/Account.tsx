import React, { useState } from 'react';
import { Button, Card, Form, Input, message, Progress, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const API = import.meta.env.VITE_API_URL || '';

function passwordStrength(pwd: string): { percent: number; color: string; label: string } {
  if (!pwd) return { percent: 0, color: '#f5222d', label: '' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { percent: 20, color: '#f5222d', label: 'Weak' };
  if (score <= 2) return { percent: 40, color: '#fa8c16', label: 'Fair' };
  if (score <= 3) return { percent: 65, color: '#fadb14', label: 'Good' };
  if (score === 4) return { percent: 85, color: '#52c41a', label: 'Strong' };
  return { percent: 100, color: '#1677ff', label: 'Very Strong' };
}

const Account: React.FC = () => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const strength = passwordStrength(newPwd);

  const handleSubmit = async () => {
    try {
      const { currentPassword, newPassword } = await form.validateFields();
      setSubmitting(true);
      const res = await fetch(`${API}/api/users/me/password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message);
      message.success('Password changed successfully');
      form.resetFields();
      setNewPwd('');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <Card bordered={false} style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ marginBottom: 24 }}>
            <Title level={4} style={{ margin: '0 0 4px 0' }}>Security Settings</Title>
            <Text type="secondary">Update your account password</Text>
          </div>

          <Form form={form} layout="vertical" requiredMark={false}>
            <Form.Item
              name="currentPassword"
              label="Current Password"
              rules={[{ required: true, message: 'Please enter your current password' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Your current password"
              />
            </Form.Item>

            <Form.Item
              name="newPassword"
              label="New Password"
              rules={[
                { required: true, message: 'Please enter a new password' },
                { min: 8, message: 'At least 8 characters' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('currentPassword') !== value) return Promise.resolve();
                    return Promise.reject(new Error('New password must differ from current password'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Minimum 8 characters"
                onChange={(e) => setNewPwd(e.target.value)}
              />
            </Form.Item>

            {newPwd && (
              <div style={{ marginTop: -12, marginBottom: 20 }}>
                <Progress
                  percent={strength.percent}
                  strokeColor={strength.color}
                  showInfo={false}
                  size="small"
                  style={{ marginBottom: 4 }}
                />
                <Text style={{ fontSize: 12, color: strength.color }}>{strength.label}</Text>
              </div>
            )}

            <Form.Item
              name="confirmPassword"
              label="Confirm New Password"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Please confirm your new password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                    return Promise.reject(new Error('Passwords do not match'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="Re-enter new password"
              />
            </Form.Item>

            <Button type="primary" loading={submitting} onClick={handleSubmit} style={{ marginTop: 4 }}>
              Change Password
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default Account;
