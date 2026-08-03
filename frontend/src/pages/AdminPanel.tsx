import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CrownOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  MoreOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import './UserManagement.css';

const { Title, Text } = Typography;
const { confirm } = Modal;
const API = import.meta.env.VITE_API_URL || '';

type Role = 'admin' | 'site_admin' | 'operator' | 'viewer';
type UserStatus = 'active' | 'inactive';

interface AdminUser {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  status: UserStatus;
  last_login: string | null;
  created_at: string;
  created_by: number | null;
  created_by_username: string | null;
  created_by_display_name: string | null;
  sites: { id: number; name: string }[];
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

const rolePermissions: Record<Role, string> = {
  admin: 'Full system access — all sites, all users, all configuration',
  site_admin: 'Full access to assigned sites; can manage own sub-users',
  operator: 'Configuration, monitoring, reports, device control (no user management)',
  viewer: 'View dashboards and reports — read-only access',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const AdminPanel: React.FC = () => {
  const [userForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [siteForm] = Form.useForm();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [allSites, setAllSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  const [addEditModal, setAddEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdTargetId, setPwdTargetId] = useState<number | null>(null);
  const [siteModal, setSiteModal] = useState(false);
  const [siteTargetId, setSiteTargetId] = useState<number | null>(null);

  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

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
      const matchSearch = !q ||
        u.display_name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.created_by_username ?? '').toLowerCase().includes(q);
      const matchRole = !roleFilter || u.role === roleFilter;
      const matchStatus = !statusFilter || u.status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchText, roleFilter, statusFilter]);

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = { admin: 0, site_admin: 0, operator: 0, viewer: 0 };
    users.forEach((u) => { if (u.role in c) c[u.role]++; });
    return c;
  }, [users]);

  // ── Add / Edit user ──────────────────────────────────────────────────────
  const handleAdd = () => {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({ role: 'site_admin', siteIds: [] });
    setAddEditModal(true);
  };

  const handleEdit = (record: AdminUser) => {
    setEditingUser(record);
    userForm.setFieldsValue({
      displayName: record.display_name,
      username: record.username,
      role: record.role,
      status: record.status,
      siteIds: record.sites.map((s) => s.id),
    });
    setAddEditModal(true);
  };

  const handleSaveUser = async () => {
    try {
      const values = await userForm.validateFields();
      setSaving(true);
      const siteIds: number[] = values.role === 'admin' ? [] : (values.siteIds ?? []);
      if (editingUser) {
        const res = await fetch(`${API}/api/users/${editingUser.id}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: values.displayName, role: values.role, status: values.status }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message);
        if (values.role !== 'admin') {
          await fetch(`${API}/api/users/${editingUser.id}/sites`, {
            method: 'PUT', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteIds }),
          });
        }
        message.success('User updated');
      } else {
        const res = await fetch(`${API}/api/users`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: values.username, password: values.password,
            displayName: values.displayName, role: values.role, siteIds,
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

  // ── Deactivate ───────────────────────────────────────────────────────────
  const handleDeactivate = (record: AdminUser) => {
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

  // ── Reset password ───────────────────────────────────────────────────────
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

  // ── Assign sites ─────────────────────────────────────────────────────────
  const openSiteModal = (record: AdminUser) => {
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

  // ── Table columns ────────────────────────────────────────────────────────
  const columns: ColumnsType<AdminUser> = [
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
      render: (role: Role) => (
        <Tag color={roleColorMap[role] ?? 'default'} style={{ width: 90, textAlign: 'center', margin: 0, fontWeight: 500 }}>
          {roleLabelMap[role] ?? role}
        </Tag>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 90,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'} style={{ margin: 0, textTransform: 'capitalize' }}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Sites', key: 'sites', width: 90,
      render: (_, record) => {
        const isAdmin = record.role === 'admin';
        const siteList = isAdmin ? allSites : record.sites;
        const count = siteList.length;
        const tooltipContent = (
          <div style={{ minWidth: 140 }}>
            {isAdmin && <div style={{ fontWeight: 600, marginBottom: 4, color: '#faad14' }}>All Sites</div>}
            {count === 0
              ? <span style={{ color: '#999' }}>No sites assigned</span>
              : siteList.map((s) => <div key={s.id} style={{ lineHeight: '20px' }}>{s.name}</div>)
            }
          </div>
        );
        const tagColor = isAdmin ? 'gold' : count === 0 ? 'default' : 'blue';
        const label = isAdmin ? `${count} (All)` : String(count);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tooltip title={tooltipContent} placement="right">
              <Tag color={tagColor} style={{ margin: 0, cursor: 'default', minWidth: 36, textAlign: 'center' }}>
                {label}
              </Tag>
            </Tooltip>
            {!isAdmin && (
              <EditOutlined
                style={{ fontSize: 11, color: '#1677ff', cursor: 'pointer', flexShrink: 0 }}
                onClick={() => openSiteModal(record)}
              />
            )}
          </div>
        );
      },
    },
    {
      title: 'Managed By', key: 'managed_by',
      render: (_, record) => {
        if (!record.created_by) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
        return (
          <Text style={{ fontSize: 12 }}>
            {record.created_by_display_name || record.created_by_username}
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>@{record.created_by_username}</Text>
          </Text>
        );
      },
    },
    {
      title: 'Last Login', dataIndex: 'last_login', key: 'last_login', width: 150,
      render: (v: string | null) => <Text type="secondary" style={{ fontSize: 12 }}>{fmtDate(v)}</Text>,
    },
    {
      title: '', key: 'action', width: 60, align: 'center',
      render: (_, record) => {
        const items: MenuProps['items'] = [
          { key: 'edit', label: 'Edit User', icon: <EditOutlined />, onClick: () => handleEdit(record) },
          { key: 'sites', label: 'Assign Sites', icon: <SafetyCertificateOutlined />, onClick: () => openSiteModal(record), disabled: record.role === 'admin' },
          { key: 'reset', label: 'Reset Password', icon: <KeyOutlined />, onClick: () => openPwdModal(record.id) },
          { type: 'divider' },
          {
            key: 'deactivate', label: record.status === 'active' ? 'Deactivate' : 'Already Inactive',
            icon: <DeleteOutlined />, danger: true,
            disabled: record.status === 'inactive' || record.role === 'admin',
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

  const roleSummary = [
    { role: 'admin' as Role, color: '#cf1322', bg: '#fff1f0', icon: <CrownOutlined />, desc: 'Internal superusers' },
    { role: 'site_admin' as Role, color: '#531dab', bg: '#f9f0ff', icon: <TeamOutlined />, desc: 'Customer admins' },
    { role: 'operator' as Role, color: '#1677ff', bg: '#e6f4ff', icon: '⚙️', desc: 'Configure & monitor' },
    { role: 'viewer' as Role, color: '#52c41a', bg: '#f6ffed', icon: '👁', desc: 'Read-only access' },
  ];

  return (
    <div className="user-management">
      <div className="user-management__container">
        {/* Role summary cards */}
        <Row gutter={16} className="user-management__role-summary">
          {roleSummary.map(({ role, color, bg, icon, desc }) => (
            <Col xs={12} sm={6} key={role}>
              <div className="user-management__role-card" style={{ borderLeftColor: color }}>
                <div className="user-management__role-icon" style={{ background: bg, color }}>
                  {icon}
                </div>
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

        {/* Main table */}
        <Card bordered={false} className="user-management__table-card">
          <div className="user-management__header">
            <Row justify="space-between" align="middle" gutter={[16, 16]}>
              <Col>
                <Title level={4} style={{ margin: '0 0 4px 0', color: '#001B34' }}>All User Accounts</Title>
                <Text type="secondary">{users.length} total users across {Object.values(roleCounts).filter((c) => c > 0).length} roles</Text>
              </Col>
              <Col>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Add User</Button>
              </Col>
            </Row>
            <div className="user-management__filters">
              <Input
                placeholder="Search by name, username or manager"
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                className="user-management__search"
                allowClear
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Select placeholder="Role" className="user-management__filter-select" allowClear onChange={setRoleFilter}
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'site_admin', label: 'Site Admin' },
                  { value: 'operator', label: 'Operator' },
                  { value: 'viewer', label: 'Viewer' },
                ]}
              />
              <Select placeholder="Status" className="user-management__filter-select" allowClear onChange={setStatusFilter}
                options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
              />
            </div>
          </div>
          <Table columns={columns} dataSource={filteredUsers} rowKey="id" loading={loading}
            pagination={{ pageSize: 15, showTotal: (t) => `Total ${t} users`, showSizeChanger: false }}
          />
        </Card>
      </div>

      {/* Add / Edit Modal */}
      <Modal title={editingUser ? 'Edit User' : 'Add User'} open={addEditModal}
        onOk={handleSaveUser} onCancel={() => setAddEditModal(false)}
        okText="Save" cancelText="Cancel" confirmLoading={saving} centered width={520} destroyOnClose>
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
              <Select.Option value="admin">
                <Tag color="volcano" style={{ marginRight: 6 }}>Admin</Tag>Internal superuser
              </Select.Option>
              <Select.Option value="site_admin">
                <Tag color="purple" style={{ marginRight: 6 }}>Site Admin</Tag>Customer administrator
              </Select.Option>
              <Select.Option value="operator">
                <Tag color="blue" style={{ marginRight: 6 }}>Operator</Tag>Configure &amp; monitor
              </Select.Option>
              <Select.Option value="viewer">
                <Tag color="green" style={{ marginRight: 6 }}>Viewer</Tag>Read-only access
              </Select.Option>
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
              const role = getFieldValue('role') as Role | undefined;
              if (!role) return null;
              return (
                <div className="user-management__role-hint">
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <strong>{roleLabelMap[role]}:</strong> {rolePermissions[role]}
                  </Text>
                </div>
              );
            }}
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
            {({ getFieldValue }) => {
              const role = getFieldValue('role') as Role | undefined;
              if (role === 'admin' || !role) return null;
              return (
                <Form.Item name="siteIds" label="Site Access" style={{ marginTop: 16, marginBottom: 0 }}>
                  <Select
                    mode="multiple"
                    maxTagCount="responsive"
                    placeholder="Select sites…"
                    listHeight={200}
                    options={allSites.map((s) => ({ value: s.id, label: s.name }))}
                    notFoundContent={<span style={{ fontSize: 12, color: '#8c8c8c' }}>No sites configured — add sites first</span>}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset Password Modal */}
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

      {/* Assign Sites Modal */}
      <Modal title="Assign Sites" open={siteModal} onOk={handleSaveSites} onCancel={() => setSiteModal(false)}
        okText="Save" cancelText="Cancel" confirmLoading={saving} centered width={460} destroyOnClose>
        <Form form={siteForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="siteIds" label="Assigned Sites">
            <Select
              mode="multiple"
              maxTagCount="responsive"
              placeholder="Select sites…"
              listHeight={220}
              options={allSites.map((s) => ({ value: s.id, label: s.name }))}
              notFoundContent={<span style={{ fontSize: 12, color: '#8c8c8c' }}>No sites configured — add sites first</span>}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminPanel;
