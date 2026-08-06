import React, { useState } from 'react';
import api from './api';
import { Form, Button, Card } from 'react-bootstrap';
import { toast } from 'react-toastify';

const PersonalAccountPage: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const getLoggedInUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      toast.error('New password and confirm password do not match.');
      return;
    }

    const loggedInUser = getLoggedInUser();
    if (!loggedInUser || !loggedInUser._id) {
      toast.error('User not logged in or user ID not found.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.put('/api/users/change-password', {
        userId: loggedInUser._id,
        currentPassword,
        newPassword,
      });

      if (response.status === 200) {
        toast.success(response.data.message);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.response?.data?.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4 animate-fade-in">
      <Card className="border-0 shadow-sm">
        <Card.Header as="h5" className="bg-white border-bottom py-3">Change Password</Card.Header>
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="formCurrentPassword">
              <Form.Label>Current Password</Form.Label>
              <Form.Control
                type="password"
                className="bg-light border-0"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formNewPassword">
              <Form.Label>New Password</Form.Label>
              <Form.Control
                type="password"
                className="bg-light border-0"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-4" controlId="formConfirmNewPassword">
              <Form.Label>Confirm New Password</Form.Label>
              <Form.Control
                type="password"
                className="bg-light border-0"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
              />
            </Form.Group>

            <Button variant="primary-green" type="submit" className="w-100 py-2 rounded-pill font-weight-bold" disabled={loading}>
              {loading ? 'Changing...' : 'Change Password'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default PersonalAccountPage;
