import React, { useState, useMemo } from 'react';
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
  LockOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import './UserManagement.css';

const { Title, Text } = Typography;
const { confirm } = Modal;

type Role = 'admin' | 'operator' | 'visitor';
type UserStatus = 'active' | 'inactive' | 'locked';

interface CloudUser {
  id: number;
  username: string;
  displayName: string;
  email: string;
  role: Role;
  status: UserStatus;
  lastLoginAt: string;
  createdAt: string;
}

const roleColorMap: Record<Role, string> = {
  admin: 'volcano',
  operator: 'blue',
  visitor: 'green',
};

const roleLabelMap: Record<Role, string> = {
  admin: 'Admin',
  operator: 'Operator',
  visitor: 'Visitor',
};

const statusColorMap: Record<UserStatus, string> = {
  active: 'green',
  inactive: 'default',
  locked: 'red',
};

const rolePermissions: Record<Role, string[]> = {
  admin: ['Full system access', 'User management', 'Configuration', 'Monitoring', 'Reports'],
  operator: ['Configuration', 'Monitoring', 'Reports', 'Device control'],
  visitor: ['View dashboards', 'View reports', 'Read-only access'],
};

const mockUsers: CloudUser[] = [
  { id: 1, username: 'admin', displayName: 'System Administrator', email: 'admin@tmas.cloud', role: 'admin', status: 'active', lastLoginAt: '2026-03-31 09:15', createdAt: '2025-01-01' },
  { id: 2, username: 'john.ops', displayName: 'John Chen', email: 'john.chen@company.com', role: 'operator', status: 'active', lastLoginAt: '2026-03-30 14:22', createdAt: '2025-06-15' },
  { id: 3, username: 'sarah.ops', displayName: 'Sarah Lim', email: 'sarah.lim@company.com', role: 'operator', status: 'active', lastLoginAt: '2026-03-31 08:45', createdAt: '2025-08-20' },
  { id: 4, username: 'mike.view', displayName: 'Mike Tan', email: 'mike.tan@company.com', role: 'visitor', status: 'active', lastLoginAt: '2026-03-28 16:30', createdAt: '2025-11-03' },
  { id: 5, username: 'lisa.view', displayName: 'Lisa Wong', email: 'lisa.wong@partner.com', role: 'visitor', status: 'inactive', lastLoginAt: '2026-02-10 11:00', createdAt: '2025-12-01' },
  { id: 6, username: 'david.ops', displayName: 'David Ng', email: 'david.ng@company.com', role: 'operator', status: 'locked', lastLoginAt: '2026-03-25 09:00', createdAt: '2026-01-10' },
  { id: 7, username: 'emma.view', displayName: 'Emma Koh', email: 'emma.koh@company.com', role: 'visitor', status: 'active', lastLoginAt: '2026-03-29 10:15', createdAt: '2026-02-14' },
];

const UserManagement: React.FC = () => {
  const [userForm] = Form.useForm();
  const [users, setUsers] = useState<CloudUser[]>(mockUsers);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<CloudUser | null>(null);
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const query = searchText.toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        user.displayName.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);
      const matchesRole = !roleFilter || user.role === roleFilter;
      const matchesStatus = !statusFilter || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchText, roleFilter, statusFilter]);

  const roleCounts = useMemo(() => {
    const counts = { admin: 0, operator: 0, visitor: 0 };
    users.forEach((u) => { counts[u.role] += 1; });
    return counts;
  }, [users]);

  const handleAdd = () => {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({ role: 'visitor', email: '' });
    setIsModalVisible(true);
  };

  const handleEdit = (record: CloudUser) => {
    setEditingUser(record);
    userForm.setFieldsValue({
      displayName: record.displayName,
      username: record.username,
      email: record.email,
      role: record.role,
    });
    setIsModalVisible(true);
  };

  const handleDelete = (record: CloudUser) => {
    confirm({
      title: 'Delete User',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: `Are you sure you want to permanently delete "${record.displayName}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        setUsers((prev) => prev.filter((u) => u.id !== record.id));
        message.success(`User "${record.displayName}" deleted`);
      },
    });
  };

  const handleToggleLock = (record: CloudUser) => {
    const nextStatus: UserStatus = record.status === 'locked' ? 'active' : 'locked';
    const action = nextStatus === 'locked' ? 'lock' : 'unlock';
    confirm({
      title: `${action === 'lock' ? 'Lock' : 'Unlock'} User`,
      icon: <ExclamationCircleOutlined style={{ color: action === 'lock' ? '#ff4d4f' : '#52c41a' }} />,
      content: `Are you sure you want to ${action} "${record.displayName}"?`,
      okText: action === 'lock' ? 'Lock' : 'Unlock',
      okType: action === 'lock' ? 'danger' : 'primary',
      cancelText: 'Cancel',
      onOk: () => {
        setUsers((prev) =>
          prev.map((u) => (u.id === record.id ? { ...u, status: nextStatus } : u)),
        );
        message.success(`User "${record.displayName}" ${action}ed`);
      },
    });
  };

  const handleSave = () => {
    userForm.validateFields().then((values) => {
      confirm({
        title: editingUser ? 'Save Changes' : 'Create User',
        icon: <ExclamationCircleOutlined style={{ color: '#1890ff' }} />,
        content: editingUser
          ? `Save changes to "${values.displayName}"?`
          : `Create new user "${values.displayName}"?`,
        okText: 'Save',
        cancelText: 'Cancel',
        onOk: () => {
          if (editingUser) {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === editingUser.id
                  ? { ...u, displayName: values.displayName, username: values.username, email: values.email || '', role: values.role }
                  : u,
              ),
            );
            message.success('User updated successfully');
          } else {
            const newUser: CloudUser = {
              id: Math.max(...users.map((u) => u.id)) + 1,
              username: values.username,
              displayName: values.displayName,
              email: values.email || '',
              role: values.role,
              status: 'active',
              lastLoginAt: '-',
              createdAt: new Date().toISOString().slice(0, 10),
            };
            setUsers((prev) => [...prev, newUser]);
            message.success('User created successfully');
          }
          setIsModalVisible(false);
        },
      });
    });
  };

  const columns: ColumnsType<CloudUser> = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <div className="user-management__user-cell">
          <div className="user-management__avatar">
            {record.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <Text strong>{record.displayName}</Text>
            <div><Text type="secondary">{record.username}</Text></div>
          </div>
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: Role) => (
        <Tag color={roleColorMap[role]} style={{ width: 80, textAlign: 'center', margin: 0, fontWeight: 500 }}>
          {roleLabelMap[role]}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: UserStatus) => (
        <Tag color={statusColorMap[status]} style={{ margin: 0, textTransform: 'capitalize' }}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 160,
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: '',
      key: 'action',
      width: 60,
      align: 'center',
      render: (_, record) => {
        const items: MenuProps['items'] = [
          {
            key: 'edit',
            label: 'Edit User',
            icon: <EditOutlined />,
            onClick: () => handleEdit(record),
          },
          {
            key: 'lock',
            label: record.status === 'locked' ? 'Unlock User' : 'Lock User',
            icon: <LockOutlined />,
            onClick: () => handleToggleLock(record),
            disabled: record.username === 'admin',
          },
          { type: 'divider' },
          ...(record.username !== 'admin'
            ? [
                {
                  key: 'delete',
                  label: 'Delete User',
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => handleDelete(record),
                } as const,
              ]
            : []),
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
        {/* Main table card */}
        <Card bordered={false} className="user-management__table-card">
          {/* Header */}
          <div className="user-management__header">
            <Row justify="space-between" align="middle" gutter={[16, 16]}>
              <Col>
                <Title level={4} style={{ margin: '0 0 4px 0', color: '#001B34' }}>User Accounts</Title>
                <Text type="secondary">{users.length} users across {Object.values(roleCounts).filter((c) => c > 0).length} roles</Text>
              </Col>
              <Col>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                  Add User
                </Button>
              </Col>
            </Row>

            {/* Filters */}
            <div className="user-management__filters">
              <Input
                placeholder="Search by name, username, or email"
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                className="user-management__search"
                allowClear
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Select
                placeholder="Role"
                className="user-management__filter-select"
                allowClear
                onChange={setRoleFilter}
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'operator', label: 'Operator' },
                  { value: 'visitor', label: 'Visitor' },
                ]}
              />
              <Select
                placeholder="Status"
                className="user-management__filter-select"
                allowClear
                onChange={setStatusFilter}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'locked', label: 'Locked' },
                ]}
              />
            </div>
          </div>

          <Table
            columns={columns}
            dataSource={filteredUsers}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showTotal: (total) => `Total ${total} users`,
              showSizeChanger: false,
            }}
          />
        </Card>

        {/* Add / Edit Modal */}
        <Modal
          title={editingUser ? 'Edit User' : 'Add User'}
          open={isModalVisible}
          onOk={handleSave}
          onCancel={() => setIsModalVisible(false)}
          okText="Save"
          cancelText="Cancel"
          centered
          width={480}
        >
          <Form form={userForm} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item name="displayName" label="Display Name" rules={[{ required: true, message: 'Please enter display name' }]}>
              <Input prefix={<UserOutlined />} placeholder="Full name" />
            </Form.Item>
            <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Please enter username' }]}>
              <Input placeholder="Login username" disabled={editingUser?.username === 'admin'} />
            </Form.Item>
            {!editingUser && (
              <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please enter password' }, { min: 6, message: 'Minimum 6 characters' }]}>
                <Input.Password placeholder="Minimum 6 characters" />
              </Form.Item>
            )}
            <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Please enter a valid email' }]}>
              <Input placeholder="user@company.com" />
            </Form.Item>
            <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Please select a role' }]}>
              <Select disabled={editingUser?.username === 'admin'}>
                {editingUser?.username === 'admin' && (
                  <Select.Option value="admin">Admin</Select.Option>
                )}
                <Select.Option value="operator">Operator</Select.Option>
                <Select.Option value="visitor">Visitor</Select.Option>
              </Select>
            </Form.Item>
            {/* Role description */}
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
              {({ getFieldValue }) => {
                const role = getFieldValue('role') as Role | undefined;
                if (!role) return null;
                return (
                  <div className="user-management__role-hint">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <strong>{roleLabelMap[role]}</strong>: {rolePermissions[role].join(', ')}
                    </Text>
                  </div>
                );
              }}
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

export default UserManagement;
