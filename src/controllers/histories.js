/* eslint-disable consistent-return */
/* eslint-disable camelcase */
/* eslint-disable radix */
const historyModel = require('../models/histories');
const vehicleModel = require('../models/vehicles');
const userModel = require('../models/users');

const helperGet = require('../helpers/get');
const response = require('../helpers/response');
const check = require('../helpers/check');

const getHistories = (req, res) => {
  const username = req.user.role;
  if (username === 'Admin') {
    helperGet(req, res, historyModel.getHistories, historyModel.countHistory, 'histories');
  } else {
    helperGet(req, res, historyModel.getHistoriesByUsername, historyModel.countHistoryByUsername, 'histories', username);
  }
};

const getHistory = async (req, res) => {
  const { id } = req.params;
  const user = req.user.role;
  const resFin = (results) => {
    if (results.length > 0) {
      return response(req, res, `History with id ${id}`, results[0]);
    }
    return response(req, res, 'History not found', null, null, 404);
  };
  if (user === 'Admin') {
    const result = await historyModel.getHistoryAsync(id);
    resFin(result);
  } else {
    const result = await historyModel.getHistoryUser(id, req.user.id);
    resFin(result);
  }
};

const addHistory = async (req, res) => {
  const {
    id_vehicle, rent_start_date, rent_end_date, prepayment,
  } = req.body;
  let id_user;
  if (req.user.role === 'Admin') {
    id_user = req.body.id_user;
  } else {
    id_user = req.user.id;
  }
  if (id_user && id_vehicle && rent_start_date && rent_end_date && prepayment) {
    const user = await userModel.getUserById(id_user);
    if (user.length === 0) {
      return response(req, res, 'User is not available', null, null, 400);
    }
    const vehicle = await vehicleModel.getVehicleAsync(id_vehicle);
    if (vehicle.length === 0) {
      return response(req, res, 'Vehicle is not available', null, null, 400);
    }
    if (!check.checkDate(rent_start_date) || !check.checkDate(rent_end_date)) {
      return response(req, res, 'Wrong date input. Format date YYYY-MM-DD', null, null, 400);
    }
    if (!check.checkStartEnd(rent_start_date, rent_end_date)) {
      return response(req, res, 'rent end must be greater than rent start', null, null, 400);
    }
    if (/\D/g.test(prepayment)) {
      return response(req, res, 'Prepayment must be number', null, null, 400);
    }
    const minPrepayment = vehicle[0].price * (20 / 100);
    if (Number(prepayment) < minPrepayment) {
      return response(req, res, `Minimal prepayment is ${minPrepayment}`, null, null, 400);
    }
    const data = {
      id_user, id_vehicle, rent_start_date, rent_end_date, prepayment, status: 2,
    };
    const addNewHistory = await historyModel.addHistory(data);
    if (addNewHistory.affectedRows > 0) {
      vehicleModel.addRentCount(id_vehicle);
      const newHistory = await historyModel.getHistoryAsync(addNewHistory.insertId);
      return response(req, res, 'Successfully added new History', newHistory[0]);
    }
    return response(req, res, 'Unexpedted error', null, null, 500);
  }
  return response(req, res, 'Failed add new history, data must be filled', null, null, 400);
};

const editAllHistory = (req, res) => {
  if (req.user.role === 'Admin') {
    const { id } = req.params;
    const {
      id_user, id_vehicle, rent_start_date, rent_end_date, prepayment, status,
    } = req.body;

    if (id_user && id_vehicle && rent_start_date && rent_end_date && prepayment && status) {
      if (!check.checkStartEnd(rent_start_date, rent_end_date)) {
        return response(req, res, 'rent end must be greater than rent start', null, null, 400);
      }
      return userModel.getUser(id_user, (user) => {
        if (user.length > 0) {
          return vehicleModel.getVehicle(id_vehicle, (vehicle) => {
            if (vehicle.length > 0) {
              const pola = /\D/g;
              if (!pola.test(prepayment)) {
                if (check.checkDate(rent_start_date) && check.checkDate(rent_end_date)) {
                  if (Number(status) >= 1 || Number(status) <= 2) {
                    const data = {
                      id_user, id_vehicle, rent_start_date, rent_end_date, prepayment, status,
                    };
                    return historyModel.editHistory(data, id, (results) => {
                      if (results.changedRows > 0) {
                        return historyModel.getHistory(id, (rslt) => response(req, res, 'Edited successfully', rslt));
                      }
                      return response(req, res, `Failed to edit history with id ${id}. Data has not changed`, null, null, 400);
                    });
                  }
                  return response(req, res, 'Status unknown! 1 for has been returned and 2 for not been returned', null, null, 400);
                }
                return response(req, res, 'Wrong date input for rent_start_date or rent_end_date. Format date YYYY-MM-DD', null, null, 400);
              }
              return response(req, res, 'Prepayment must be number', null, null, 400);
            }
            return response(req, res, 'id_vehicle is undifined', null, null, 400);
          });
        }
        return response(req, res, 'id_user is undefined', null, null, 400);
      });
    }
    return response(req, res, `Failed edit history with id ${id}, data must be filled`, null, null, 400);
  }
  return response(req, res, 'Only admin can update history', null, null, 403);
};

const editHistory = async (req, res) => {
  if (req.user.role === 'Admin') {
    const { id } = req.params;
    const history = await historyModel.getHistoryAsync(id);
    if (history.length === 0) {
      return response(req, res, 'History not available', null, null, 404);
    }
    const {
      id_user, id_vehicle, rent_start_date, rent_end_date, prepayment, status,
    } = req.body;
    const data = {
      id_user: history[0].id_user,
      id_vehicle: history[0].id_vehicle,
      rent_start_date: history[0].rent_start_date,
      rent_end_date: history[0].rent_end_date,
      prepayment: history[0].prepayment,
      status: history[0].status,
    };

    if (id_user) {
      const checkUser = await userModel.getUserById(id_user);
      if (checkUser.length === 0) {
        return response(req, res, 'User id not available', null, null, 400);
      }
      data.id_user = id_user;
    }
    if (id_vehicle) {
      const checkUser = await vehicleModel.getVehicleAsync(id_vehicle);
      if (checkUser.length === 0) {
        return response(req, res, 'Vehicle id not available', null, null, 400);
      }
      data.id_vehicle = id_vehicle;
    }
    if (rent_start_date) {
      if (!check.checkDate(rent_start_date)) {
        return response(req, res, 'Wrong date input for rent_start_date. Format date YYYY-MM-DD', null, null, 400);
      }
      data.rent_start_date = rent_start_date;
    }
    if (rent_end_date) {
      if (!check.checkDate(rent_end_date)) {
        return response(req, res, 'Wrong date input for rent_end_date . Format date YYYY-MM-DD', null, null, 400);
      }
      data.rent_end_date = rent_end_date;
    }
    const notNum = /\D/g;
    if (prepayment) {
      if (notNum.test(prepayment)) {
        return response(req, res, 'Prepayment must be number', null, null, 400);
      }
      data.prepayment = prepayment;
    }
    if (status) {
      if (Number(status) !== 1 && Number(status) !== 2) {
        return response(req, res, 'Status unknown! 1 for has been returned and 2 for not been returned', null, null, 400);
      }
      data.status = status;
    }
    if (!check.checkStartEnd(data.rent_start_date, data.rent_end_date)) {
      return response(req, res, 'rent end must be greater than rent start', null, null, 400);
    }
    const update = await historyModel.updateHistory(data, id);
    if (update.affectedRows > 0) {
      const results = await historyModel.getHistoryAsync(id);
      return response(req, res, 'Update vehicle successfully', results);
    }
    return response(req, res, 'Unexpected error', null, null, 500);
  }
};

const deleteHistory = (req, res) => {
  if (req.user.role === 'Admin') {
    const { id } = req.params;
    historyModel.getHistoryDeleted(id, (historyDeleted) => {
      historyModel.deleteHistory(id, (results) => {
        if (results.affectedRows > 0) {
          return response(req, res, `History with id ${id} successfully deleted`, historyDeleted[0]);
        }
        return response(req, res, `Failed to delete history with id ${id}`, null, null, 400);
      });
    });
  }
  return response(req, res, 'Only admin can delete history', null, null, 403);
};

module.exports = {
  getHistories,
  getHistory,
  addHistory,
  editAllHistory,
  editHistory,
  deleteHistory,
};
