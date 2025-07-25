const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

//for managing time checkin and checkout
const moment = require("moment");

// Load environment variables
dotenv.config();




// Initialize app
const app = express();
const PORT = process.env.PORT;




app.use(cors());
app.use(express.json());
app.use(express.static("../public"));



// Creating pool




// Regular expressions for manager and employee emails
const managerEmailRegex = /^[a-zA-Z0-9._%+-]+\.mn@company\.com$/;
const employeeEmailRegex = /^[a-zA-Z0-9._%+-]+\.emp@company\.com$/;





// Checking the connection successful or not

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit:0
})

pool.getConnection((err,connection)=>{
    if(err){
        console.log("Mysql Connection error: ",err.message);
        return;
    }

    console.log("Connected to MySQL database.");
    connection.release();
})





//---------------------------------------- SignUp route -----------------------------------------


app.post('/signup',(req,res)=>{
    const {email, password, confirm_password} = req.body;

    if((!managerEmailRegex.test(email))&&(!employeeEmailRegex.test(email))){
        return res.status(400).json({error:"Invalid email format. Please use the correct format"});
    }

    if(password!=confirm_password){
        return res.status(400).json({error:"Passwords do no match."});
    }

    const role = email.includes(".mn@")?"manager":"employee";

   pool.query('SELECT * FROM USERS WHERE email = ?',[email],(err,results)=>{
    if(err){
        console.log("Signup error: ",err);
        return res.status(500).json({error:"Server error!"});
    }

    if(results.length>0){
        return res.status(400).json({error:"User already exists with this email."});
    }

    bcrypt.hash(password,10,(err,hashedPassword)=>{
        if(err){
            console.log("Hashing error: ",err);
            return res.status(500).json({error:"Server error!"});
        }

        const insertQuery = 'INSERT INTO users (email,password,role) VALUES (?,?,?)';
        pool.query(insertQuery,[email,hashedPassword,role],(err,result)=>{
            if(err){
                console.log("Signup error: ",err);
                return res.status(500).json({error:"Server error!",redirect:'/'});
            }

            return res.status(200).json({message:"Signup successful. Please login now.",redirect:'/login'});
        })
    })
   })

})






// --------------------------------- LOGIN route ------------------------------------------

app.post('/login',(req,res)=>{
    const {email, password} = req.body;
    if(!managerEmailRegex.test(email) && !employeeEmailRegex.test(email)){
        console.log("please enter valid email.");
        return res.status(400).json({error:"Enter valid email"});
    }


    const getQuery = "SELECT * FROM users WHERE email = ?";
    pool.query(getQuery,[email],(err,results)=>{
        if(err){
            console.log("Login DB error: ",err);
            return res.status(500).json({error:"Server error!"});
        }

        if(results.length == 0){
            return res.status(404).json({error:"No user found with this email.",redirect:"/"});
        }

        const user = results[0];

        bcrypt.compare(password,user.password,(err,isMatch)=>{
            if(err){
                console.log("Bcrypt compare error: ",err);
            }

            if(!isMatch){
                return res.status(401).json({error:"Incorrect password."});
            }

            const mgr = Boolean(email.includes("mn"));
            console.log(mgr);

            return res.status(200).json({message:"Login successful",redirect: mgr ? "/dashboard" : "/employees_dashboard" ,user_id:user.id});
        })

    })

    
})









// -------------------------------  Check-In Route ------------------------------------
app.post('/checkin',(req,res)=>{
    console.log("entered post request");
    const {userId} = req.body;
    console.log(userId);
    const currentDate = moment().format("YYYY-MM-DD");
    console.log(currentDate);
    const currentTime = moment().format("HH:mm:ss");
    console.log(currentTime);

    pool.query('SELECT * FROM attendance WHERE user_id = ? AND date = ?',[userId, currentDate],(err,results)=>{
        console.log("Entered the query");
        if(err){
            return res.status(500).json({error:"DB error"});
        }

        console.log("Passed first if condition");

        if(results.length>0){
            return res.status(400).json({error:"Already checked in today!"});
        }

        console.log("Passed second if condition");

        let status = "Present";
        const limit = moment("9:30:00","HH:mm:ss");
        if(moment(currentTime,"HH:mm:ss").isAfter(limit)){
            status = "Late";
        }

        console.log(status);

        pool.query("INSERT INTO attendance (user_id,date,checkin_time,status) VALUES (?,?,?,?)",[userId,currentDate,currentTime,status],(err2)=>{
            console.log("entered first pool query");
            if(err2){
                return res.status(500).json({error:"Insert failed!"});

            }

            pool.query("SELECT * FROM USERS WHERE id = ?",[userId],(err3,result2)=>{
                if(err3 || result2.length == 0){
                    return res.status(500).json({error:"User lookup failed"});
                }

                const userName = result2[0].email;
                console.log(userName);
                res.json({message:`Checked in as ${status}`,data:{
                    name:userName,
                    date:currentDate,
                    checkInTime: currentTime,
                    checkOutTime: null,
                    status_of: status
                }});
            })
        })
    })
})








// -------------------------------  Check-Out Route ------------------------------------
app.post('/checkout',(req,res)=>{
    const {userId} = req.body;
    const currentDate = moment().format("YYYY-MM-DD");
    const currentTime = moment().format("HH:mm:ss");

    pool.query("SELECT * FROM attendance WHERE user_id = ? AND date = ?",[userId,currentDate],(err,results)=>{
        if(err){
            return res.status(500).json({error:"DB error"});
        }

        if(results.length == 0){
            return res.status(400).json({error:"No check-in found!"});
        }

        let finalStatus = results[0].status;
        

        pool.query("UPDATE attendance SET checkout_time = ?, status = ? WHERE user_id = ? AND date = ? ",[currentTime,finalStatus,userId,currentDate],(err2)=>{
            if(err2){
                return res.status(500).json({error:"Update failed"});
            }

            pool.query("SELECT * FROM USERS WHERE id = ?",[userId],(err3,result2)=>{
                if(err3 || result2.length == 0){
                    return res.status(500).json({error:"User lookup failed"});
                }

                const userName = result2[0].email;
                res.json({message:`Checked out as ${finalStatus}`,data:{
                    name:userName,
                    date:currentDate,
                    checkInTime: results[0].checkin_time,
                    checkOutTime: currentTime,
                    status_of: finalStatus
                }});
            })
        })
    })
})









// ---------------------------------   Get Recent Attendance for all Managers  --------------------------------//

app.get('/api/recent-attendance',(req,res)=>{
    const userId = req.query.user_id;
    const currentDate = moment().format("YYYY-MM-DD");
    if(!userId){
        return res.status(401).json({error:"Unauthorized access"});
    }

    const queryEmail = 'SELECT email FROM USERS WHERE id = ?';
    pool.query(queryEmail,[userId],(err,results)=>{
        if(err){
            return res.status(500).send({error:"Database error"});
        }

        const email = results[0]?.email;

        if(!email){
            return res.status(404).send({error:"User not found"});
        }

        const isEmployee = email.includes("emp");

        const query = isEmployee
        ?`
            SELECT u.email,a.date,a.checkin_time,a.checkout_time,a.status
            FROM ATTENDANCE a
            JOIN USERS u ON u.id = a.user_id
            WHERE a.user_id = ? AND a.date = ?
            ORDER BY a.date DESC LIMIT 5
        `
        :`
            SELECT u.email,a.date,a.checkin_time,a.checkout_time,a.status
            FROM ATTENDANCE a
            JOIN USERS u ON u.id = a.user_id
            WHERE a.date = ?
            ORDER BY a.date DESC LIMIT 5
        `;

        const params = isEmployee?[userId,currentDate]:[currentDate];   // for employee u need to pass the userID bur for the manager u shd not. so params is required so that it passes an empty array for manager
        pool.query(query,params,(err,results)=>{
            if(err){
                return res.status(500).json({error:"Database error!"});
            }

            const formattedResults = results.map(row=>({
                ...row,
                date: moment(row.date).format("YYYY-MM-DD")
            }));
            
            res.json({data: formattedResults});
        })
    })

});







// ------------------------------------------ For employees get attendance only related to them ----------------------------------------------//
app.get('/api/employee-manager-user-attendance',(req,res)=>{

    const userId = req.query.user_id;
    if(!userId){
        return res.status(401).json({error:"Unauthorized access"});
    }

    

    const queryEmail = 'SELECT email FROM USERS WHERE id = ?';
    pool.query(queryEmail,[userId],(err,results)=>{
        if(err){
            return res.status(500).json({error:'Database error'});
        }

        const email = results[0]?.email;

        if(!email){
            return res.status(404).json({error:"User not found"});
        }

        const isEmployee = email.includes("emp");

        const query = isEmployee
        ?`
            SELECT u.email,a.date,a.checkin_time,a.checkout_time,a.status
            FROM ATTENDANCE a
            JOIN USERS u ON u.id = a.user_id
            WHERE a.user_id = ?
            ORDER BY a.date DESC
        `
        :`
            SELECT u.email,a.date,a.checkin_time,a.checkout_time,a.status
            FROM ATTENDANCE a
            JOIN USERS u ON u.id = a.user_id
            ORDER BY a.date DESC
        `;

        const params = isEmployee?[userId]:[];   // for employee u need to pass the userID bur for the manager u shd not. so params is required so that it passes an empty array for manager
        pool.query(query,params,(err,results)=>{
            if(err){
                return res.status(500).json({error:"Database error!"});
            }

            const formattedResults = results.map(row=>({
                ...row,
                date: moment(row.date).format("YYYY-MM-DD")
            }));
            
            res.json({data: formattedResults});
        })
    })

})









//------------------------------------------  Search employee by using the input filed in recent attendance -----------------------------
app.get('/search-employee-attendance',(req,res)=>{
    const searchQuery = req.query.query;
    console.log(searchQuery);

    if(!searchQuery){
        return res.status(400).json({message:"Search query is required"});
    }

    const sql =  `
        SELECT u.email,a.date,a.checkin_time, a.checkout_time, a.status
        FROM ATTENDANCE a
        JOIN USERS u ON a.user_id = u.id
        WHERE u.email LIKE ? 
        ORDER BY a.date DESC
    `;

    const likeQuery =  `%${searchQuery}%`;

    pool.query(sql,[likeQuery],(err,results)=>{
        if(err){
            console.error(err);
            return res.status(500).json({message:"Internal server error"});
        }

        res.json(results);
    })

})




//---------------------------------SEARCH EMPLOYEE USING INPUT FIELD IN EMPLOYEE DIRECTORY ------------------------



app.get('/search-employee-directory',(req,res)=>{
    const searchQuery = req.query.query;
    console.log(searchQuery);
    if(!searchQuery){
        return res.status(400).json({message:"Search query is required"});
    }

    const sql =  `
        SELECT * FROM EMPLOYEES WHERE full_name = ?
    `

    const likeQuery = `%${searchQuery}%`;

    pool.query(sql,[likeQuery],(err,results)=>{
        if(err){
            console.error(err);
            return res.status(500).json({message:"Internal server error"});
        }

        res.json(results);
    })
})







//-------------------------- API CALL TO SHOW ATLEAST 6-7 RECORDS IN THE PAGE AFTER LOGIN ---------------------------------
app.get('/get-initial-employees',(req,res)=>{
    const query = `
        SELECT * FROM EMPLOYEES ORDER BY id DESC LIMIT 5
    `;

    pool.query(query,(err,results)=>{
        if(err){
            console.log("enteren")
            console.error("Database error: ",err);
            return res.status(500).json({error:"Failed to fetch employees"});
        }

        return res.status(200).json(results);
    })


})









// ------------------------------------ EMPLOYEES SECTION DASHBOARD UNDER THE MANAGER ----------------------------------
app.post('/add-new-employee',(req,res)=>{
    const data = req.body;
    if(!data){
        return res.status(400).send({error:"No data yet. Please try again later!"});
    }

    const query =  `
        INSERT INTO EMPLOYEES(full_name,email,position,department) VALUES (?,?,?,?)
    `;

    pool.query(query,[data.fullName,data.Email,data.position,data.department],(err,results)=>{
        if(err){
            return res.status(500).send({error:"Database error!"});
        }

        return res.status(201).send({message:"Data added successfully"});
    })
})





//--------------------------- view all records in employee directory ---------------------
app.get('/get-allRecords-employeeDirectory',(req,res)=>{
    const query = `
        SELECT * FROM EMPLOYEES ORDER BY id DESC
    `;

    pool.query(query,(err,results)=>{
        if(err){
            console.error("Database error: ",err);
            return res.status(500).json({error:"Failed to fetch data"});
        }

        return res.status(200).json(results);
    })
})





//------------------------ Load initial recent attendance data --------------------------------------
app.get('/load-initial-recent-attendance-data',(req,res)=>{
    const query =  `            
        SELECT u.email,a.date,a.checkin_time,a.checkout_time,a.status
        FROM ATTENDANCE a
        JOIN USERS u ON u.id = a.user_id
        ORDER BY a.date DESC LIMIT 5`;

    pool.query(query,(err,results)=>{
        if(err){
            return res.status(500).json({error: err});
        }

        const formattedResults = results.map(row=>({
                ...row,
                date: moment(row.date).format("YYYY-MM-DD")
            }));
            
            res.json({data: formattedResults});

    })
})










//--------------------------- Updating count of total employees in manager dashboard ----------------
app.get('/count_total_employees',(req,res)=>{
    const query =  `SELECT COUNT(DISTINCT email) AS count FROM USERS WHERE email LIKE '%emp%'`;
    pool.query(query,(err,results)=>{
        if(err){
            return res.status(500).json({err:err});
        }
        console.log(results);

        return res.status(200).json(results);
        
    })
})



//-------------------------- COUNT OF total employees who were present today  ---------------------
app.get('/count_present_today',(req,res)=>{

    const currentDate = moment().format("YYYY-MM-DD");

    const query =  `SELECT COUNT(DISTINCT u.email) AS count FROM USERS u
                    JOIN ATTENDANCE a ON a.user_id = u.id
                    WHERE a.status = 'Present' AND date = '${currentDate}'`;

    pool.query(query,(err,results)=>{
        if(err){
            return res.status(500).send({err:err});

        }

        return res.status(200).send(results);
    })
})








//-------------------------- COUNT OF total employees who were late today  ---------------------
app.get('/count_late_today',(req,res)=>{

    const currentDate = moment().format("YYYY-MM-DD");

    const query =  `SELECT COUNT(DISTINCT u.email) AS count FROM USERS u
                    JOIN ATTENDANCE a ON a.user_id = u.id
                    WHERE a.status = 'Late' AND date = '${currentDate}'`;

    pool.query(query,(err,results)=>{
        if(err){
            return res.status(500).send({err:err});

        }

        return res.status(200).send(results);
    })
})







app.get("/dashboard",(req,res)=>{
    res.sendFile('/Users/kkarthik/Documents/MyProjects/Employee_attendance_system/public/dashboard.html');
})


app.get("/employees_dashboard",(req,res)=>{
    res.sendFile('/Users/kkarthik/Documents/MyProjects/Employee_attendance_system/public/employees_dashboard.html');
})


app.get('/',(req,res)=>{
    console.log(__dirname);
    res.sendFile('/Users/kkarthik/Documents/MyProjects/Employee_attendance_system/public/signup.html');
})

app.get('/login',(req,res)=>{
    res.sendFile('/Users/kkarthik/Documents/MyProjects/Employee_attendance_system/public/login.html');
})



app.listen(PORT,()=>{
    console.log(`Server running on http://localhost${PORT}`);
})