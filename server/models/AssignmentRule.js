const mongoose = require('mongoose');

const assignmentRuleSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['round_robin', 'territory'],
    default: 'round_robin',
  },
  // lastAssigned can be either a single userId (for global round-robin)
  // or a map of territory -> userId for territory-based round-robin
  lastAssigned: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

const AssignmentRule = mongoose.model('AssignmentRule', assignmentRuleSchema);

module.exports = AssignmentRule;
