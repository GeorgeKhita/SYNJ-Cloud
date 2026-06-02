import * as serviceRepo from '../repositories/service.repository.js';

export async function list(req, res) {
  const { email } = req.query;
  const services = email
    ? await serviceRepo.findByEmail(email)
    : await serviceRepo.findAll();
  res.json({ services });
}
