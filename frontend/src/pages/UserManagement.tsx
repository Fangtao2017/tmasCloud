import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  MoreOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAuth } from '../context/AuthContext';
import './UserManagement.css';

const { Title, Text } = Typography;
const { confirm } = Modal;
const API = import.meta.env.VITE_API_URL || '';

type UserStatus = 'active' | 'inactive';

interface ManagedUser {
  id: number;
  username: string;
  display_name: string;
  role: string;
  status: UserStatus;
  last_login: string | null;
  created_at: string;
  sites: { id: number; name: string }[];
}

interface Site {
  id: number;
  name: string;
}

const roleColorMap: Record<string, string> = {
  operator: 'blue',
  viewer: 'green',
};

const roleLabelMap: Record<string, string> = {
  operator: 'Operator',
  viewer: 'Viewer',
};

const rolePermissions: Record<string, string> = {
  operator: 'Configuration, monitoring, reports, device control',
  viewer: 'View dashboards and reports — read-only access',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const UserManagement: React.FC = () => {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  // Admin users should use AdminPanel instead
  useEffect(() => {
    if (authUser?.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [authUser, navigate]);
  const [userForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [siteForm] = Form.useForm();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  const [addEditModal, setAddEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdTargetId, setPwdTargetId] = useState<number | null>(null);
  const [siteModal, setSiteModal] = useState(false);
  const [siteTargetId, setSiteTargetId] = useState<number | null>(null);

  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const availableSites = useMemo(() => {
    if (!authUser?.siteIds) return allSites;
    return allSites.filter((s) => authUser.siteIds!.includes(s.id));
  }, [allSites, authUser]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/users`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      const { users: data } = await res.json();
      setUsers(data);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const res = await fetch(`${API}/api/sites`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setAllSites(Array.isArray(data) ? data : (data.sites ?? []));
        }
      } catch { /* non-critical */ }
    };
    fetchUsers();
    fetchSites();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchText.toLowerCase();
    return users.filter((u) => {
      const matchSearch = !q || u.display_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
      const matchRole = !roleFilter || u.role === roleFilter;
      const matchStatus = !statusFilter || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchText, roleFilter, statusFilter]);

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = { operator: 0, viewer: 0 };
    users.forEach((u) => { if (u.role in c) c[u.role]++; });
    return c;
  }, [users]);

  const handleAdd = () => {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({ role: 'operator' });
    setAddEditModal(true);
  };

  const handleEdit = (record: ManagedUser) => {
    setEditingUser(record);
    userForm.setFieldsValue({
      displayName: record.display_name,
      username: record.username,
      role: record.role,
      status: record.status,
    });
    setAddEditModal(true);
  };

  const handleSaveUser = async () => {
    try {
      const values = await userForm.validateFields();
      setSaving(true);
      if (editingUser) {
        const res = await fetch(`${API}/api/users/${editingUser.id}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: values.displayName, role: values.role, status: values.status }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message);
        message.success('User updated');
      } else {
        const res = await fetch(`${API}/api/users`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: values.username, password: values.password,
            displayName: values.displayName, role: values.role, siteIds: [],
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message);
        message.success('User created');
      }
      setAddEditModal(false);
      fetchUsers();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = (record: ManagedUser) => {
    confirm({
      title: 'Deactivate User',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: `Deactivate "${record.display_name}"? They will lose access immediately.`,
      okText: 'Deactivate', okType: 'danger', cancelText: 'Cancel',
      onOk: async () => {
        try {
          const res = await fetch(`${API}/api/users/${record.id}`, { method: 'DELETE', credentials: 'include' });
          const body = await res.json();
          if (!res.ok) throw new Error(body.message);
          message.success('User deactivated');
          fetchUsers();
        } catch (err: unknown) {
          message.error(err instanceof Error ? err.message : 'Failed');
        }
      },
    });
  };

  const openPwdModal = (id: number) => {
    setPwdTargetId(id);
    pwdForm.resetFields();
    setPwdModal(true);
  };

  const handleResetPwd = async () => {
    try {
      const { newPassword } = await pwdForm.validateFields();
      setSaving(true);
      const res = await fetch(`${API}/api/users/${pwdTargetId}/reset-password`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message);
      message.success('Password reset successfully');
      setPwdModal(false);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const openSiteModal = (record: ManagedUser) => {
    setSiteTargetId(record.id);
    siteForm.setFieldsValue({ siteIds: record.sites.map((s) => s.id) });
    setSiteModal(true);
  };

  const handleSaveSites = async () => {
    try {
      const { siteIds } = await siteForm.validateFields();
      setSaving(true);
      const res = await fetch(`${API}/api/users/${siteTargetId}/sites`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteIds: siteIds ?? [] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message);
      message.success('Sites updated');
      setSiteModal(false);
      fetchUsers();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<ManagedUser> = [
    {
      title: 'User', key: 'user',
      render: (_, record) => (
        <div className="user-management__user-cell">
          <div className="user-management__avatar">
            {(record.display_name || record.username).charAt(0).toUpperCase()}
          </div>
          <div>
            <Text strong>{record.display_name}</Text>
            <div><Text type="secondary" style={{ fontSize: 12 }}>@{record.username}</Text></div>
          </div>
        </div>
      ),
    },
    {
      title: 'Role', dataIndex: 'role', key: 'role', width: 110,
      render: (role: string) => (
        <Tag color={roleColorMap[role] ?? 'default'} style={{ width: 80, textAlign: 'center', margin: 0, fontWeight: 500 }}>
          {roleLabelMap[role] ?? role}
        </Tag>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'} style={{ margin: 0, textTransform: 'capitalize' }}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Sites', key: 'sites',
      render: (_, record) => {
        const inner = record.sites.length === 0
          ? <Text type="secondary" style={{ fontSize: 12 }}>None assigned</Text>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {record.sites.map((s) => <Tag key={s.id} style={{ margin: 0, fontSize: 11 }}>{s.name}</Tag>)}
            </div>;
        return (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            onClick={() => openSiteModal(record)}
            title="Click to assign sites"
          >
            {inner}
            <EditOutlined style={{ fontSize: 11, color: '#1677ff' }} />
          </div>
        );
      },
    },
    {
      title: 'Last Login', dataIndex: 'last_login', key: 'last_login', width: 160,
      render: (v: string | null) => <Text type="secondary" style={{ fontSize: 12 }}>{fmtDate(v)}</Text>,
    },
    {
      title: '', key: 'action', width: 60, align: 'center',
      render: (_, record) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: 'Edit User', icon: <EditOutlined />, onClick: () => handleEdit(record) },
          { key: 'sites', label: 'Assign Sites', icon: <SafetyCertificateOutlined />, onClick: () => openSiteModal(record) },
          { key: 'reset', label: 'Reset Password', icon: <KeyOutlined />, onClick: () => openPwdModal(record.id) },
          { type: 'divider' },
          {
            key: 'deactivate', label: record.status === 'active' ? 'Deactivate' : 'Already Inactive',
            icon: <DeleteOutlined />, danger: true, disabled: record.status === 'inactive',
            onClick: () => handleDeactivate(record),
          },
        ];
        return (
          <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<MoreOutlined style={{ fontSize: 18, color: '#8c8c8c' }} />} />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <div className="user-management">
      <div className="user-management__container">
        <Row gutter={16} className="user-management__role-summary">
          {[
            { role: 'operator', color: '#1677ff', bg: '#e6f4ff', icon: '⚙️', desc: 'Configure & monitor' },
            { role: 'viewer', color: '#52c41a', bg: '#f6ffed', icon: '👁', desc: 'Read-only access' },
          ].map(({ role, color, bg, icon, desc }) => (
            <Col xs={12} key={role}>
              <div className="user-management__role-card" style={{ borderLeftColor: color }}>
                <div className="user-management__role-icon" style={{ background: bg }}>{icon}</div>
                <div className="user-management__role-info">
                  <span className="user-management__role-count">{roleCounts[role] ?? 0}</span>
                  <Text type="secondary" style={{ fontSize: 12 }}>{roleLabelMap[role]}</Text>
                </div>
                <div className="user-management__role-desc">
                  <Text type="secondary" style={{ fontSize: 11 }}>{desc}</Text>
                </div>
              </div>
            </Col>
          ))}
        </Row>

        <Card bordered={false} className="user-management__table-card">
          <div className="user-management__header">
            <Row justify="space-between" align="middle" gutter={[16, 16]}>
              <Col>
                <Title level={4} style={{ margin: '0 0 4px 0', color: '#001B34' }}>User Accounts</Title>
                <Text type="secondary">{users.length} users</Text>
              </Col>
              <Col>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add User</Button>
              </Col>
            </Row>
            <div className="user-management__filters">
              <Input
                placeholder="Search by name or username"
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                className="user-management__search"
                allowClear
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Select placeholder="Role" className="user-management__filter-select" allowClear onChange={setRoleFilter}
                options={[{ value: 'operator', label: 'Operator' }, { value: 'viewer', label: 'Viewer' }]}
              />
              <Select placeholder="Status" className="user-management__filter-select" allowClear onChange={setStatusFilter}
                options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
              />
            </div>
          </div>
          <Table columns={columns} dataSource={filteredUsers} rowKey="id" loading={loading}
            pagination={{ pageSize: 10, showTotal: (t) => `Total ${t} users`, showSizeChanger: false }}
          />
        </Card>
      </div>

      <Modal title={editingUser ? 'Edit User' : 'Add User'} open={addEditModal}
        onOk={handleSaveUser} onCancel={() => setAddEditModal(false)}
        okText="Save" cancelText="Cancel" confirmLoading={saving} centered width={480} destroyOnClose>
        <Form form={userForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="displayName" label="Display Name" rules={[{ required: true, message: 'Required' }]}>
            <Input prefix={<UserOutlined />} placeholder="Full name" />
          </Form.Item>
          {!editingUser && (
            <>
              <Form.Item name="username" label="Username" rules={[
                { required: true, message: 'Required' },
                { pattern: /^[a-z0-9._-]+$/, message: 'Lowercase letters, numbers, . _ - only' },
              ]}>
                <Input placeholder="login.username" />
              </Form.Item>
              <Form.Item name="password" label="Password" rules={[
                { required: true, message: 'Required' }, { min: 8, message: 'Minimum 8 characters' },
              ]}>
                <Input.Password placeholder="Minimum 8 characters" />
              </Form.Item>
            </>
          )}
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Required' }]}>
            <Select>
              <Select.Option value="operator">Operator</Select.Option>
              <Select.Option value="viewer">Viewer</Select.Option>
            </Select>
          </Form.Item>
          {editingUser && (
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="inactive">Inactive</Select.Option>
              </Select>
            </Form.Item>
          )}
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
            {({ getFieldValue }) => {
              const role = getFieldValue('role') as string | undefined;
              if (!role || !rolePermissions[role]) return null;
              return (
                <div className="user-management__role-hint">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <strong>{roleLabelMap[role] ?? role}:</strong> {rolePermissions[role]}
                  </Text>
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Reset Password" open={pwdModal} onOk={handleResetPwd} onCancel={() => setPwdModal(false)}
        okText="Reset" cancelText="Cancel" confirmLoading={saving} centered width={420} destroyOnClose>
        <Form form={pwdForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="newPassword" label="New Password" rules={[
            { required: true, message: 'Required' }, { min: 8, message: 'Minimum 8 characters' },
          ]}>
            <Input.Password placeholder="Minimum 8 characters" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="Confirm Password" dependencies={['newPassword']} rules={[
            { required: true, message: 'Required' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('Passwords do not match'));
              },
            }),
          ]}>
            <Input.Password placeholder="Re-enter new password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Assign Sites" open={siteModal} onOk={handleSaveSites} onCancel={() => setSiteModal(false)}
        okText="Save" cancelText="Cancel" confirmLoading={saving} centered width={420} destroyOnClose>
        <Form form={siteForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="siteIds" label="Sites">
            <Select mode="multiple" placeholder="Select sites to assign"
              options={availableSites.map((s) => ({ value: s.id, label: s.name }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
